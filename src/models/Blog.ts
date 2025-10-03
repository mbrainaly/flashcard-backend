import mongoose, { Document, Schema } from 'mongoose';

export interface IBlog extends Document {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'published' | 'archived';
  author: {
    adminId: mongoose.Types.ObjectId;
    name: string;
    email: string;
  };
  categories: mongoose.Types.ObjectId[];
  tags: mongoose.Types.ObjectId[];
  featuredImage?: {
    url: string;
    alt: string;
    caption?: string;
  };
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
    canonicalUrl?: string;
  };
  publishedAt?: Date;
  scheduledFor?: Date;
  views: number;
  likes: number;
  comments: {
    id: string;
    author: {
      name: string;
      email: string;
    };
    content: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Date;
    replies: {
      id: string;
      author: {
        adminId: mongoose.Types.ObjectId;
        name: string;
      };
      content: string;
      createdAt: Date;
    }[];
  }[];
  readingTime: number; // in minutes
  isSticky: boolean;
  allowComments: boolean;
  metadata: {
    wordCount: number;
    lastEditedBy: {
      adminId: mongoose.Types.ObjectId;
      name: string;
      email: string;
    };
    revisionHistory: {
      version: number;
      editedBy: {
        adminId: mongoose.Types.ObjectId;
        name: string;
      };
      changes: string;
      timestamp: Date;
    }[];
  };
  relatedPosts: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const BlogSchema: Schema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
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
  excerpt: {
    type: String,
    required: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  author: {
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
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogCategory'
  }],
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogTag'
  }],
  featuredImage: {
    url: {
      type: String,
      trim: true
    },
    alt: {
      type: String,
      trim: true
    },
    caption: {
      type: String,
      trim: true
    }
  },
  seo: {
    title: {
      type: String,
      required: true,
      maxlength: 60
    },
    description: {
      type: String,
      required: true,
      maxlength: 160
    },
    keywords: [{
      type: String,
      trim: true
    }],
    ogImage: {
      type: String,
      trim: true
    },
    canonicalUrl: {
      type: String,
      trim: true
    }
  },
  publishedAt: {
    type: Date
  },
  scheduledFor: {
    type: Date
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  comments: [{
    id: {
      type: String,
      required: true
    },
    author: {
      name: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      }
    },
    content: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    replies: [{
      id: {
        type: String,
        required: true
      },
      author: {
        adminId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Admin',
          required: true
        },
        name: {
          type: String,
          required: true
        }
      },
      content: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  readingTime: {
    type: Number,
    default: 1
  },
  isSticky: {
    type: Boolean,
    default: false
  },
  allowComments: {
    type: Boolean,
    default: true
  },
  metadata: {
    wordCount: {
      type: Number,
      default: 0
    },
    lastEditedBy: {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      },
      name: String,
      email: String
    },
    revisionHistory: [{
      version: {
        type: Number,
        required: true
      },
      editedBy: {
        adminId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Admin',
          required: true
        },
        name: {
          type: String,
          required: true
        }
      },
      changes: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  relatedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog'
  }]
}, {
  timestamps: true
});

// Indexes
BlogSchema.index({ slug: 1 });
BlogSchema.index({ status: 1 });
BlogSchema.index({ publishedAt: -1 });
BlogSchema.index({ 'author.adminId': 1 });
BlogSchema.index({ categories: 1 });
BlogSchema.index({ tags: 1 });
BlogSchema.index({ views: -1 });
BlogSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate reading time and word count
BlogSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    const wordCount = this.content.split(/\s+/).length;
    this.metadata.wordCount = wordCount;
    this.readingTime = Math.ceil(wordCount / 200); // Average reading speed: 200 words per minute
  }
  
  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Generate slug from title if not provided
BlogSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

export default mongoose.model<IBlog>('Blog', BlogSchema);
