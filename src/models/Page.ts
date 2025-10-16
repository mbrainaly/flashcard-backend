import mongoose, { Document, Schema } from 'mongoose';

export interface IPage extends Document {
  title: string;
  slug: string;
  content: string;
  status: 'published' | 'draft' | 'review';
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
    canonicalUrl?: string;
  };
  lastModified: Date;
  lastModifiedBy: {
    adminId: mongoose.Types.ObjectId;
    name: string;
    email: string;
  };
  views: number;
  isSystem: boolean;
  sections?: {
    id: string;
    title: string;
    content: string;
    image?: string;
    order: number;
  }[];
  teamMembers?: {
    id: string;
    name: string;
    role: string;
    bio: string;
    image?: string;
    socialLinks: {
      linkedin?: string;
      twitter?: string;
      github?: string;
    };
  }[];
  contactInfo?: {
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    businessHours: {
      [key: string]: string;
    };
    socialMedia: {
      twitter?: string;
      facebook?: string;
      linkedin?: string;
      instagram?: string;
    };
  };
  features?: {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: string;
    isPremium: boolean;
    order: number;
  }[];
  companyInfo?: {
    founded: string;
    mission: string;
    vision: string;
    values: Array<{
      name: string;
      icon: string;
      description: string;
    }>;
  };
  formSettings?: {
    enabled: boolean;
    emailNotifications: boolean;
    autoReply: boolean;
    autoReplyMessage: string;
  };
  version?: string;
  effectiveDate?: Date;
  jurisdiction?: string;
  governingLaw?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PageSchema: Schema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['published', 'draft', 'review'],
    default: 'draft'
  },
  seo: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    keywords: [{
      type: String
    }],
    ogImage: String,
    canonicalUrl: String
  },
  lastModified: {
    type: Date,
    default: Date.now
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
  views: {
    type: Number,
    default: 0
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  sections: [{
    id: String,
    title: String,
    content: String,
    image: String,
    order: Number
  }],
  teamMembers: [{
    id: String,
    name: String,
    role: String,
    bio: String,
    image: String,
    socialLinks: {
      linkedin: String,
      twitter: String,
      github: String
    }
  }],
  contactInfo: {
    email: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    businessHours: {
      type: Map,
      of: String
    },
    socialMedia: {
      twitter: String,
      facebook: String,
      linkedin: String,
      instagram: String
    }
  },
  features: [{
    id: String,
    title: String,
    description: String,
    icon: String,
    category: String,
    isPremium: Boolean,
    order: Number
  }],
  companyInfo: {
    founded: String,
    mission: String,
    vision: String,
    values: [{
      name: String,
      icon: String,
      description: String
    }]
  },
  formSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    autoReply: {
      type: Boolean,
      default: false
    },
    autoReplyMessage: String
  },
  version: String,
  effectiveDate: Date,
  jurisdiction: String,
  governingLaw: String
}, {
  timestamps: true
});

// Indexes
PageSchema.index({ slug: 1 });
PageSchema.index({ status: 1 });
PageSchema.index({ lastModified: -1 });

// Pre-save middleware to update lastModified
PageSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastModified = new Date();
  }
  next();
});

export default mongoose.model<IPage>('Page', PageSchema);
