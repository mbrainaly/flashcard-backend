import mongoose, { Document, Schema } from 'mongoose'

export interface IActivityLog extends Document {
  adminId: Schema.Types.ObjectId
  action: string
  details: string
  ipAddress?: string
  userAgent?: string
  createdAt: Date
  updatedAt: Date
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Action cannot exceed 100 characters']
    },
    details: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Details cannot exceed 500 characters']
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
)

// Index for efficient querying
activityLogSchema.index({ adminId: 1, createdAt: -1 })

const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema)

export default ActivityLog
