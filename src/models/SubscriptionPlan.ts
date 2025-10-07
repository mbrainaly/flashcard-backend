import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  features: {
    maxDecks: number;
    maxCards: number;
    maxAiGenerations: number;
    maxStorage: number; // in MB
    prioritySupport: boolean;
    advancedAnalytics: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    exportFeatures: boolean;
    collaborativeDecks: boolean;
    offlineAccess: boolean;
    customCategories: boolean;
  };
  limits: {
    dailyAiGenerations: number;
    monthlyAiGenerations: number;
    concurrentSessions: number;
    fileUploadSize: number; // in MB
  };
  trial: {
    enabled: boolean;
    durationDays: number;
    features: string[];
  };
  visibility: {
    isActive: boolean;
    isPublic: boolean;
    availableFrom?: Date;
    availableUntil?: Date;
  };
  selectedFeatures: string[]; // Array of feature keys from AVAILABLE_FEATURES
  metadata: {
    stripeProductId?: string;
    stripePriceId?: string;
    paypalPlanId?: string;
    color: string;
    icon: string;
    badge?: string; // e.g., "Most Popular", "Best Value"
    sortOrder: number;
  };
  createdBy: {
    adminId: mongoose.Types.ObjectId;
    name: string;
    email: string;
  };
  lastModifiedBy: {
    adminId: mongoose.Types.ObjectId;
    name: string;
    email: string;
  };
  statistics: {
    activeSubscriptions: number;
    totalRevenue: number;
    conversionRate: number;
    churnRate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  price: {
    monthly: {
      type: Number,
      required: true,
      min: 0
    },
    yearly: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'USD'
    }
  },
  features: {
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
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    advancedAnalytics: {
      type: Boolean,
      default: false
    },
    customBranding: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    },
    exportFeatures: {
      type: Boolean,
      default: false
    },
    collaborativeDecks: {
      type: Boolean,
      default: false
    },
    offlineAccess: {
      type: Boolean,
      default: false
    },
    customCategories: {
      type: Boolean,
      default: false
    }
  },
  limits: {
    dailyAiGenerations: {
      type: Number,
      required: true,
      min: 0
    },
    monthlyAiGenerations: {
      type: Number,
      required: true,
      min: 0
    },
    concurrentSessions: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    fileUploadSize: {
      type: Number,
      required: true,
      min: 1,
      default: 10
    }
  },
  trial: {
    enabled: {
      type: Boolean,
      default: false
    },
    durationDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 365
    },
    features: [{
      type: String,
      trim: true
    }]
  },
  visibility: {
    isActive: {
      type: Boolean,
      default: true
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    availableFrom: Date,
    availableUntil: Date
  },
  selectedFeatures: {
    type: [String],
    default: [],
    validate: {
      validator: function(features: string[]) {
        // Import available features for validation
        const { AVAILABLE_FEATURES } = require('../config/features');
        const validFeatureKeys = AVAILABLE_FEATURES.map((f: any) => f.key);
        return features.every(feature => validFeatureKeys.includes(feature));
      },
      message: 'Invalid feature key provided'
    }
  },
  metadata: {
    stripeProductId: {
      type: String,
      trim: true
    },
    stripePriceId: {
      type: String,
      trim: true
    },
    paypalPlanId: {
      type: String,
      trim: true
    },
    color: {
      type: String,
      required: true,
      default: '#3B82F6',
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    },
    icon: {
      type: String,
      required: true,
      default: 'star'
    },
    badge: {
      type: String,
      trim: true
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  createdBy: {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  lastModifiedBy: {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  statistics: {
    activeSubscriptions: {
      type: Number,
      default: 0,
      min: 0
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    churnRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  }
}, {
  timestamps: true
});

// Indexes
SubscriptionPlanSchema.index({ 'visibility.isActive': 1, 'visibility.isPublic': 1 });
SubscriptionPlanSchema.index({ 'metadata.sortOrder': 1 });
SubscriptionPlanSchema.index({ 'price.monthly': 1 });
SubscriptionPlanSchema.index({ 'price.yearly': 1 });

// Virtual for yearly savings percentage
SubscriptionPlanSchema.virtual('yearlySavings').get(function() {
  const monthlyTotal = this.price.monthly * 12;
  const yearlyPrice = this.price.yearly;
  if (monthlyTotal > 0) {
    return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
  }
  return 0;
});

// Virtual for feature list
SubscriptionPlanSchema.virtual('featureList').get(function() {
  const features = [];
  
  if (this.features.maxDecks === -1) {
    features.push('Unlimited Decks');
  } else if (this.features.maxDecks > 0) {
    features.push(`${this.features.maxDecks} Decks`);
  }
  
  if (this.features.maxCards === -1) {
    features.push('Unlimited Cards');
  } else if (this.features.maxCards > 0) {
    features.push(`${this.features.maxCards} Cards`);
  }
  
  if (this.features.maxAiGenerations === -1) {
    features.push('Unlimited AI Generations');
  } else if (this.features.maxAiGenerations > 0) {
    features.push(`${this.features.maxAiGenerations} AI Generations/month`);
  }
  
  if (this.features.maxStorage > 0) {
    features.push(`${this.features.maxStorage}MB Storage`);
  }
  
  if (this.features.prioritySupport) features.push('Priority Support');
  if (this.features.advancedAnalytics) features.push('Advanced Analytics');
  if (this.features.customBranding) features.push('Custom Branding');
  if (this.features.apiAccess) features.push('API Access');
  if (this.features.exportFeatures) features.push('Export Features');
  if (this.features.collaborativeDecks) features.push('Collaborative Decks');
  if (this.features.offlineAccess) features.push('Offline Access');
  if (this.features.customCategories) features.push('Custom Categories');
  
  return features;
});

// Pre-save middleware to validate availability dates
SubscriptionPlanSchema.pre('save', function(next) {
  if (this.visibility.availableFrom && this.visibility.availableUntil) {
    if (this.visibility.availableFrom >= this.visibility.availableUntil) {
      const error = new Error('Available from date must be before available until date');
      return next(error);
    }
  }
  next();
});

export default mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);
