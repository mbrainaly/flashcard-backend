import mongoose, { Document, Schema } from 'mongoose'

export interface IContactSubmission extends Document {
  firstName: string
  lastName: string
  email: string
  phone?: string
  message: string
  status: 'new' | 'read' | 'replied' | 'resolved'
  source: 'contact_page' | 'other'
  ipAddress?: string
  userAgent?: string
  submittedAt: Date
  readAt?: Date
  repliedAt?: Date
  resolvedAt?: Date
  adminNotes?: string
  assignedTo?: {
    adminId: mongoose.Types.ObjectId
    name: string
    email: string
  }
  createdAt: Date
  updatedAt: Date
}

const ContactSubmissionSchema = new Schema<IContactSubmission>({
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 255
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 20
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'resolved'],
    default: 'new'
  },
  source: {
    type: String,
    enum: ['contact_page', 'other'],
    default: 'contact_page'
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  readAt: {
    type: Date
  },
  repliedAt: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  assignedTo: {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin'
    },
    name: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    }
  }
}, {
  timestamps: true
})

// Indexes for better query performance
ContactSubmissionSchema.index({ email: 1 })
ContactSubmissionSchema.index({ status: 1 })
ContactSubmissionSchema.index({ submittedAt: -1 })
ContactSubmissionSchema.index({ 'assignedTo.adminId': 1 })

// Virtual for full name
ContactSubmissionSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`
})

// Ensure virtual fields are serialized
ContactSubmissionSchema.set('toJSON', {
  virtuals: true
})

export default mongoose.model<IContactSubmission>('ContactSubmission', ContactSubmissionSchema)