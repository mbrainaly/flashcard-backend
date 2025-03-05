import mongoose, { Document, Schema } from 'mongoose';

export interface ICard extends Document {
  deck: Schema.Types.ObjectId;
  front: string;
  back: string;
  image?: string;
  hints?: string[];
  examples?: string[];
  tags?: string[];
  status: 'new' | 'learning' | 'mastered';
  // Spaced repetition fields
  nextReview: Date;
  lastReviewed?: Date;
  interval: number; // in days
  easeFactor: number; // multiplier for interval
  repetitions: number; // number of times reviewed
  // Optional metadata
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const cardSchema = new Schema<ICard>(
  {
    deck: {
      type: Schema.Types.ObjectId,
      ref: 'Deck',
      required: true,
    },
    front: {
      type: String,
      required: [true, 'Front content is required'],
      trim: true,
    },
    back: {
      type: String,
      required: [true, 'Back content is required'],
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    hints: [{
      type: String,
      trim: true,
    }],
    examples: [{
      type: String,
      trim: true,
    }],
    tags: [{
      type: String,
      trim: true,
    }],
    status: {
      type: String,
      enum: ['new', 'learning', 'mastered'],
      default: 'new',
    },
    // Spaced repetition fields
    nextReview: {
      type: Date,
      default: Date.now,
    },
    lastReviewed: {
      type: Date,
    },
    interval: {
      type: Number,
      default: 0, // Initial interval of 0 days
    },
    easeFactor: {
      type: Number,
      default: 2.5, // Initial ease factor of 2.5
      min: 1.3, // Minimum ease factor
    },
    repetitions: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
cardSchema.index({ deck: 1, status: 1 });
cardSchema.index({ nextReview: 1 });
cardSchema.index({ tags: 1 });

// Pre-save middleware to ensure nextReview is set
cardSchema.pre('save', function(next) {
  if (this.isNew) {
    this.nextReview = new Date();
  }
  next();
});

export default mongoose.model<ICard>('Card', cardSchema); 