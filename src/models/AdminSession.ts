import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminSession extends Document {
  adminId: Schema.Types.ObjectId;
  token: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  expiresAt: Date;
  refreshExpiresAt: Date;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

const adminSessionSchema = new Schema<IAdminSession>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    refreshToken: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    ipAddress: {
      type: String,
      required: true
    },
    userAgent: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    refreshExpiresAt: {
      type: Date,
      required: true,
      index: true
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true,
  }
);

// Automatically remove expired sessions
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for better query performance
adminSessionSchema.index({ adminId: 1, isActive: 1 });
adminSessionSchema.index({ token: 1, isActive: 1 });
adminSessionSchema.index({ refreshToken: 1, isActive: 1 });

// Update last activity on save
adminSessionSchema.pre('save', function (next) {
  if (this.isModified('isActive') && this.isActive) {
    this.lastActivity = new Date();
  }
  next();
});

// Static method to cleanup expired sessions
adminSessionSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { refreshExpiresAt: { $lt: new Date() } }
    ]
  });
};

// Static method to deactivate all sessions for an admin
adminSessionSchema.statics.deactivateAllForAdmin = function(adminId: Schema.Types.ObjectId) {
  return this.updateMany(
    { adminId, isActive: true },
    { $set: { isActive: false } }
  );
};

// Static method to get active sessions count for an admin
adminSessionSchema.statics.getActiveSessionsCount = function(adminId: Schema.Types.ObjectId) {
  return this.countDocuments({
    adminId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

const AdminSession = mongoose.model<IAdminSession>('AdminSession', adminSessionSchema);

export default AdminSession;
