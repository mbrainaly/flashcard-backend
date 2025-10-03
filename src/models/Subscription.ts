import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'trialing' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  cancelReason?: string;
  trialStart?: Date;
  trialEnd?: Date;
  paymentMethod: {
    type: 'card' | 'paypal' | 'bank_transfer' | 'other';
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    paymentMethodId?: string;
  };
  billing: {
    amount: number;
    currency: string;
    interval: 'month' | 'year';
    intervalCount: number;
    nextBillingDate: Date;
    lastBillingDate?: Date;
  };
  discount?: {
    couponId: string;
    percentOff?: number;
    amountOff?: number;
    validUntil?: Date;
  };
  metadata: {
    source: 'web' | 'mobile' | 'admin' | 'api';
    referralCode?: string;
    campaignId?: string;
    upgradeFromPlan?: mongoose.Types.ObjectId;
    downgradeToPlan?: mongoose.Types.ObjectId;
  };
  usage: {
    decksCreated: number;
    cardsCreated: number;
    studySessions: number;
    aiGenerations: number;
    storageUsed: number; // in MB
  };
  limits: {
    maxDecks: number;
    maxCards: number;
    maxAiGenerations: number;
    maxStorage: number; // in MB
  };
  invoices: {
    invoiceId: string;
    amount: number;
    currency: string;
    status: 'paid' | 'pending' | 'failed' | 'refunded';
    paidAt?: Date;
    dueDate: Date;
    invoiceUrl?: string;
  }[];
  notes: {
    adminId: mongoose.Types.ObjectId;
    adminName: string;
    note: string;
    timestamp: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema: Schema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'past_due', 'trialing', 'paused'],
    default: 'active',
    index: true
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true,
    index: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  cancelledAt: {
    type: Date
  },
  cancelReason: {
    type: String,
    trim: true
  },
  trialStart: {
    type: Date
  },
  trialEnd: {
    type: Date
  },
  paymentMethod: {
    type: {
      type: String,
      enum: ['card', 'paypal', 'bank_transfer', 'other'],
      required: true
    },
    last4: String,
    brand: String,
    expiryMonth: Number,
    expiryYear: Number,
    paymentMethodId: String
  },
  billing: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'USD'
    },
    interval: {
      type: String,
      enum: ['month', 'year'],
      required: true
    },
    intervalCount: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    nextBillingDate: {
      type: Date,
      required: true,
      index: true
    },
    lastBillingDate: {
      type: Date
    }
  },
  discount: {
    couponId: {
      type: String,
      trim: true
    },
    percentOff: {
      type: Number,
      min: 0,
      max: 100
    },
    amountOff: {
      type: Number,
      min: 0
    },
    validUntil: {
      type: Date
    }
  },
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile', 'admin', 'api'],
      default: 'web'
    },
    referralCode: String,
    campaignId: String,
    upgradeFromPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan'
    },
    downgradeToPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan'
    }
  },
  usage: {
    decksCreated: {
      type: Number,
      default: 0,
      min: 0
    },
    cardsCreated: {
      type: Number,
      default: 0,
      min: 0
    },
    studySessions: {
      type: Number,
      default: 0,
      min: 0
    },
    aiGenerations: {
      type: Number,
      default: 0,
      min: 0
    },
    storageUsed: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  limits: {
    maxDecks: {
      type: Number,
      required: true,
      min: 0
    },
    maxCards: {
      type: Number,
      required: true,
      min: 0
    },
    maxAiGenerations: {
      type: Number,
      required: true,
      min: 0
    },
    maxStorage: {
      type: Number,
      required: true,
      min: 0
    }
  },
  invoices: [{
    invoiceId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      uppercase: true
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'failed', 'refunded'],
      required: true
    },
    paidAt: Date,
    dueDate: {
      type: Date,
      required: true
    },
    invoiceUrl: String
  }],
  notes: [{
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    adminName: {
      type: String,
      required: true
    },
    note: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ 'billing.nextBillingDate': 1 });
SubscriptionSchema.index({ createdAt: -1 });
SubscriptionSchema.index({ 'billing.amount': 1 });

// Virtual for days remaining
SubscriptionSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const end = new Date(this.currentPeriodEnd);
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for usage percentage
SubscriptionSchema.virtual('usagePercentage').get(function() {
  return {
    decks: this.limits.maxDecks > 0 ? (this.usage.decksCreated / this.limits.maxDecks) * 100 : 0,
    cards: this.limits.maxCards > 0 ? (this.usage.cardsCreated / this.limits.maxCards) * 100 : 0,
    aiGenerations: this.limits.maxAiGenerations > 0 ? (this.usage.aiGenerations / this.limits.maxAiGenerations) * 100 : 0,
    storage: this.limits.maxStorage > 0 ? (this.usage.storageUsed / this.limits.maxStorage) * 100 : 0
  };
});

// Pre-save middleware to update next billing date
SubscriptionSchema.pre('save', function(next) {
  if (this.isModified('currentPeriodEnd') && this.status === 'active') {
    this.billing.nextBillingDate = this.currentPeriodEnd;
  }
  next();
});

export default mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
