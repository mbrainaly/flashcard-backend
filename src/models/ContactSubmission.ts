import mongoose, { Document, Schema } from 'mongoose';

export interface IContactSubmission extends Document {
  name: string;
  email: string;
  subject?: string;
  message: string;
  phone?: string;
  company?: string;
  status: 'new' | 'read' | 'replied' | 'resolved' | 'spam';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  assignedTo?: {
    adminId: mongoose.Types.ObjectId;
    name: string;
    email: string;
  };
  replies: {
    adminId: mongoose.Types.ObjectId;
    adminName: string;
    message: string;
    timestamp: Date;
  }[];
  metadata: {
    ipAddress: string;
    userAgent: string;
    referrer?: string;
    source: string; // 'contact_form', 'api', 'manual'
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

const ContactSubmissionSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  subject: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'resolved', 'spam'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  tags: [{
    type: String,
    trim: true
  }],
  assignedTo: {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    name: String,
    email: String
  },
  replies: [{
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    adminName: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    ipAddress: {
      type: String,
      required: true
    },
    userAgent: {
      type: String,
      required: true
    },
    referrer: String,
    source: {
      type: String,
      enum: ['contact_form', 'api', 'manual'],
      default: 'contact_form'
    }
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
      required: true
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
ContactSubmissionSchema.index({ status: 1 });
ContactSubmissionSchema.index({ priority: 1 });
ContactSubmissionSchema.index({ createdAt: -1 });
ContactSubmissionSchema.index({ email: 1 });
ContactSubmissionSchema.index({ 'assignedTo.adminId': 1 });

export default mongoose.model<IContactSubmission>('ContactSubmission', ContactSubmissionSchema);
