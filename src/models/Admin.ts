import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdmin extends Document {
  email: string;
  password: string;
  name: string;
  role: 'super_admin' | 'admin' | 'moderator' | 'analyst';
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  incLoginAttempts(): Promise<IAdmin>;
  resetLoginAttempts(): Promise<void>;
  isLocked: boolean;
}

const adminSchema = new Schema<IAdmin>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please enter a valid email address'
      }
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false // Don't include password in queries by default
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'moderator', 'analyst'],
      default: 'admin',
      required: true
    },
    permissions: [{
      type: String,
      enum: [
        // User management
        'users.read', 'users.write', 'users.delete',
        // Content management
        'content.read', 'content.write', 'content.delete',
        // Analytics
        'analytics.read',
        // Subscriptions
        'subscriptions.read', 'subscriptions.write',
        // Blog management
        'blogs.read', 'blogs.write', 'blogs.delete',
        // Page management
        'pages.read', 'pages.write',
        // System management
        'system.read', 'system.write'
      ]
    }],
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date
    },
    twoFactorSecret: {
      type: String,
      select: false
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

// Virtual for checking if account is locked
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

// Hash password before saving
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Set default permissions based on role
adminSchema.pre('save', function (next) {
  if (this.isModified('role') || this.isNew) {
    switch (this.role) {
      case 'super_admin':
        this.permissions = [
          'users.read', 'users.write', 'users.delete',
          'content.read', 'content.write', 'content.delete',
          'analytics.read',
          'subscriptions.read', 'subscriptions.write',
          'blogs.read', 'blogs.write', 'blogs.delete',
          'pages.read', 'pages.write',
          'system.read', 'system.write'
        ];
        break;
      case 'admin':
        this.permissions = [
          'users.read', 'users.write',
          'content.read', 'content.write', 'content.delete',
          'analytics.read',
          'subscriptions.read',
          'blogs.read', 'blogs.write', 'blogs.delete',
          'pages.read', 'pages.write'
        ];
        break;
      case 'moderator':
        this.permissions = [
          'content.read', 'content.write',
          'blogs.read', 'blogs.write'
        ];
        break;
      case 'analyst':
        this.permissions = [
          'analytics.read',
          'users.read',
          'content.read',
          'subscriptions.read'
        ];
        break;
      default:
        this.permissions = [];
    }
  }
  next();
});

// Compare password method
adminSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    const admin = await this.model('Admin').findById(this._id).select('+password');
    if (!admin) return false;
    
    return bcrypt.compare(candidatePassword, admin.password);
  } catch (error) {
    return false;
  }
};

// Increment login attempts
adminSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates: any = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
adminSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Create indexes
adminSchema.index({ email: 1 }, { unique: true });
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });

const Admin = mongoose.model<IAdmin>('Admin', adminSchema);

export default Admin;
