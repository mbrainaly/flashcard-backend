import mongoose, { Document, Schema } from 'mongoose';

export interface IDeck extends Document {
  title: string;
  description: string;
  owner: Schema.Types.ObjectId;
  isPublic: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastStudied?: Date;
  totalCards: number;
  studyProgress: {
    mastered: number;
    learning: number;
    new: number;
  };
}

const deckSchema = new Schema<IDeck>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: false,
      trim: true,
      maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    totalCards: {
      type: Number,
      default: 0,
    },
    studyProgress: {
      mastered: {
        type: Number,
        default: 0,
      },
      learning: {
        type: Number,
        default: 0,
      },
      new: {
        type: Number,
        default: 0,
      },
    },
    lastStudied: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Add index for better query performance
deckSchema.index({ owner: 1, title: 1 });
deckSchema.index({ tags: 1 });
deckSchema.index({ isPublic: 1 });

export default mongoose.model<IDeck>('Deck', deckSchema); 