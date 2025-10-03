import mongoose, { Document, Schema } from 'mongoose';

export interface IBlogTag extends Document {
  name: string;
  slug: string;
  description?: string;
  color: string;
  isActive: boolean;
  postCount: number;
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
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
  createdAt: Date;
  updatedAt: Date;
}

const BlogTagSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 300
  },
  color: {
    type: String,
    required: true,
    default: '#10B981', // Default green color
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },
  isActive: {
    type: Boolean,
    default: true
  },
  postCount: {
    type: Number,
    default: 0
  },
  seo: {
    title: {
      type: String,
      maxlength: 60
    },
    description: {
      type: String,
      maxlength: 160
    },
    keywords: [{
      type: String,
      trim: true
    }]
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
  }
}, {
  timestamps: true
});

// Indexes
BlogTagSchema.index({ slug: 1 });
BlogTagSchema.index({ isActive: 1 });
BlogTagSchema.index({ postCount: -1 });
BlogTagSchema.index({ name: 'text' }); // For text search

// Generate slug from name if not provided
BlogTagSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

export default mongoose.model<IBlogTag>('BlogTag', BlogTagSchema);
