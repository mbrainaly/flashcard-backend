import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  type: 'payment' | 'refund' | 'chargeback' | 'adjustment' | 'credit';
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'processing';
  amount: number;
  currency: string;
  description: string;
  paymentMethod: {
    type: 'card' | 'paypal' | 'bank_transfer' | 'wallet' | 'other';
    provider: string; // stripe, paypal, etc.
    last4?: string;
    brand?: string;
    paymentMethodId?: string;
  };
  gateway: {
    provider: string;
    transactionId: string;
    gatewayFee?: number;
    gatewayResponse?: any;
  };
  invoice: {
    invoiceId?: string;
    invoiceNumber?: string;
    invoiceUrl?: string;
    dueDate?: Date;
    paidAt?: Date;
  };
  refund?: {
    refundId: string;
    refundAmount: number;
    refundReason: string;
    refundedAt: Date;
    refundedBy: {
      adminId: mongoose.Types.ObjectId;
      name: string;
    };
  };
  metadata: {
    source: 'web' | 'mobile' | 'admin' | 'api' | 'webhook';
    ipAddress?: string;
    userAgent?: string;
    referenceId?: string;
    campaignId?: string;
    promoCode?: string;
  };
  billing: {
    billingAddress?: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    taxAmount?: number;
    taxRate?: number;
    discountAmount?: number;
    subtotal: number;
    total: number;
  };
  timeline: {
    createdAt: Date;
    processedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    cancelledAt?: Date;
  };
  notes: {
    adminId: mongoose.Types.ObjectId;
    adminName: string;
    note: string;
    timestamp: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema: Schema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    index: true
  },
  type: {
    type: String,
    enum: ['payment', 'refund', 'chargeback', 'adjustment', 'credit'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'processing'],
    required: true,
    default: 'pending',
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USD'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  paymentMethod: {
    type: {
      type: String,
      enum: ['card', 'paypal', 'bank_transfer', 'wallet', 'other'],
      required: true
    },
    provider: {
      type: String,
      required: true,
      trim: true
    },
    last4: String,
    brand: String,
    paymentMethodId: String
  },
  gateway: {
    provider: {
      type: String,
      required: true,
      trim: true
    },
    transactionId: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    gatewayFee: {
      type: Number,
      min: 0
    },
    gatewayResponse: Schema.Types.Mixed
  },
  invoice: {
    invoiceId: String,
    invoiceNumber: String,
    invoiceUrl: String,
    dueDate: Date,
    paidAt: Date
  },
  refund: {
    refundId: {
      type: String,
      trim: true
    },
    refundAmount: {
      type: Number,
      min: 0
    },
    refundReason: {
      type: String,
      trim: true
    },
    refundedAt: Date,
    refundedBy: {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      },
      name: String
    }
  },
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile', 'admin', 'api', 'webhook'],
      default: 'web'
    },
    ipAddress: String,
    userAgent: String,
    referenceId: String,
    campaignId: String,
    promoCode: String
  },
  billing: {
    billingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    },
    taxAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },
  timeline: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    processedAt: Date,
    completedAt: Date,
    failedAt: Date,
    cancelledAt: Date
  },
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
TransactionSchema.index({ userId: 1, status: 1 });
TransactionSchema.index({ subscriptionId: 1 });
TransactionSchema.index({ 'gateway.transactionId': 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ amount: 1 });
TransactionSchema.index({ type: 1, status: 1 });

// Virtual for net amount (after fees)
TransactionSchema.virtual('netAmount').get(function() {
  const gatewayFee = this.gateway.gatewayFee || 0;
  return this.amount - gatewayFee;
});

// Virtual for processing time
TransactionSchema.virtual('processingTime').get(function() {
  if (this.timeline.completedAt && this.timeline.createdAt) {
    return this.timeline.completedAt.getTime() - this.timeline.createdAt.getTime();
  }
  return null;
});

// Pre-save middleware to update timeline
TransactionSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    
    switch (this.status) {
      case 'processing':
        if (!this.timeline.processedAt) {
          this.timeline.processedAt = now;
        }
        break;
      case 'completed':
        if (!this.timeline.completedAt) {
          this.timeline.completedAt = now;
        }
        break;
      case 'failed':
        if (!this.timeline.failedAt) {
          this.timeline.failedAt = now;
        }
        break;
      case 'cancelled':
        if (!this.timeline.cancelledAt) {
          this.timeline.cancelledAt = now;
        }
        break;
    }
  }
  next();
});

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
