import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd?: Date;
    customerId?: string;
    credits: number;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
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
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false // Don't include password in queries by default
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    subscription: {
      plan: {
        type: String,
        default: 'basic',
        enum: ['basic', 'pro', 'team']
      },
      status: {
        type: String,
        default: 'active',
        enum: ['active', 'inactive', 'past_due', 'canceled']
      },
      currentPeriodEnd: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      },
      customerId: {
        type: String,
        default: null
      },
      credits: {
        type: Number,
        default: 50
      }
    }
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    // Need to select password since it's excluded by default
    const user = await this.model('User').findById(this._id).select('+password');
    if (!user) return false;
    
    return bcrypt.compare(candidatePassword, user.password);
  } catch (error) {
    return false;
  }
};

// Create indexes
userSchema.index({ email: 1 }, { unique: true });

// Drop existing model and indexes if they exist
mongoose.connection.on('connected', async () => {
  try {
    if (mongoose.connection.db) {
      // Drop the existing index on username if it exists
      await mongoose.connection.db.collection('users').dropIndex('username_1').catch(() => {
        // Ignore error if index doesn't exist
        console.log('No username index to drop or already dropped');
      });
    }
  } catch (error) {
    console.log('Error handling indexes:', error);
  }
});

// Create new model
const User = mongoose.model<IUser>('User', userSchema);

export default User; 