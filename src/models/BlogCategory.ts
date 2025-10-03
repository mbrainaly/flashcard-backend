import mongoose, { Document, Schema } from 'mongoose';

export interface IBlogCategory extends Document {
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon?: string;
  parentCategory?: mongoose.Types.ObjectId;
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

const BlogCategorySchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
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
    maxlength: 500
  },
  color: {
    type: String,
    required: true,
    default: '#3B82F6', // Default blue color
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },
  icon: {
    type: String,
    trim: true
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogCategory',
    default: null
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
BlogCategorySchema.index({ slug: 1 });
BlogCategorySchema.index({ isActive: 1 });
BlogCategorySchema.index({ parentCategory: 1 });
BlogCategorySchema.index({ postCount: -1 });

// Generate slug from name if not provided
BlogCategorySchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Prevent circular references in parent-child relationships
BlogCategorySchema.pre('save', async function(next) {
  if (this.parentCategory && this.parentCategory.toString() === this._id.toString()) {
    const error = new Error('A category cannot be its own parent');
    return next(error);
  }
  next();
});

export default mongoose.model<IBlogCategory>('BlogCategory', BlogCategorySchema);
