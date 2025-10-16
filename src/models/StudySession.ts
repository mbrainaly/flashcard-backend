import mongoose, { Document, Schema } from 'mongoose';

export interface IStudySession extends Document {
  userId: Schema.Types.ObjectId;
  deckId: Schema.Types.ObjectId;
  sessionType: 'flashcard' | 'quiz' | 'exam' | 'practice';
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  cardsStudied: number;
  correctAnswers: number;
  totalAnswers: number;
  accuracy: number; // percentage
  isCompleted: boolean;
  studyMode: {
    cardOrder: 'sequential' | 'random';
    cardDirection: 'front-to-back' | 'back-to-front' | 'mixed';
    showProgress: boolean;
  };
  performance: {
    easyCards: number;
    mediumCards: number;
    hardCards: number;
    skippedCards: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const studySessionSchema = new Schema<IStudySession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    deckId: {
      type: Schema.Types.ObjectId,
      ref: 'Deck',
      required: true,
      index: true
    },
    sessionType: {
      type: String,
      enum: ['flashcard', 'quiz', 'exam', 'practice'],
      required: true
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number,
      default: 0,
      min: 0
    },
    cardsStudied: {
      type: Number,
      default: 0,
      min: 0
    },
    correctAnswers: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAnswers: {
      type: Number,
      default: 0,
      min: 0
    },
    accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    studyMode: {
      cardOrder: {
        type: String,
        enum: ['sequential', 'random'],
        default: 'sequential'
      },
      cardDirection: {
        type: String,
        enum: ['front-to-back', 'back-to-front', 'mixed'],
        default: 'front-to-back'
      },
      showProgress: {
        type: Boolean,
        default: true
      }
    },
    performance: {
      easyCards: {
        type: Number,
        default: 0,
        min: 0
      },
      mediumCards: {
        type: Number,
        default: 0,
        min: 0
      },
      hardCards: {
        type: Number,
        default: 0,
        min: 0
      },
      skippedCards: {
        type: Number,
        default: 0,
        min: 0
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes for better query performance
studySessionSchema.index({ userId: 1, deckId: 1 });
studySessionSchema.index({ userId: 1, createdAt: -1 });
studySessionSchema.index({ deckId: 1, createdAt: -1 });
studySessionSchema.index({ sessionType: 1 });

// Calculate accuracy before saving
studySessionSchema.pre('save', function(next) {
  if (this.totalAnswers > 0) {
    this.accuracy = Math.round((this.correctAnswers / this.totalAnswers) * 100);
  }
  next();
});

const StudySession = mongoose.model<IStudySession>('StudySession', studySessionSchema);

export default StudySession;
