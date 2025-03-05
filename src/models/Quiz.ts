import mongoose, { Document, Schema } from 'mongoose';

export interface IQuizAttempt {
  userId: Schema.Types.ObjectId;
  score: number;
  completedAt: Date;
  timeSpent: number; // in seconds
  answers: {
    questionIndex: number;
    selectedOption: number;
    isCorrect: boolean;
    timeSpent: number; // in seconds
  }[];
}

export interface IQuizAnalytics {
  totalAttempts: number;
  averageScore: number;
  averageTimeSpent: number; // in seconds
  completionRate: number; // percentage of users who finish the quiz
  questionStats: {
    questionIndex: number;
    correctAnswers: number;
    totalAttempts: number;
    averageTimeSpent: number;
  }[];
  lastUpdated: Date;
}

export interface IQuizQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface IQuiz extends Document {
  title: string;
  description: string;
  owner: Schema.Types.ObjectId;
  noteId?: Schema.Types.ObjectId; // Optional reference to a note
  questions: IQuizQuestion[];
  isPublic: boolean;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timeLimit?: number; // in minutes
  passingScore: number; // percentage
  attempts: IQuizAttempt[];
  analytics: IQuizAnalytics;
  createdAt: Date;
  updatedAt: Date;
}

const quizSchema = new Schema<IQuiz>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    noteId: {
      type: Schema.Types.ObjectId,
      ref: 'Note',
    },
    questions: [{
      question: {
        type: String,
        required: true,
      },
      options: [{
        type: String,
        required: true,
      }],
      correctOptionIndex: {
        type: Number,
        required: true,
      },
      explanation: String,
      type: {
        type: String,
        enum: ['multiple-choice', 'true-false', 'short-answer'],
        default: 'multiple-choice',
      },
      difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'intermediate',
      },
    }],
    isPublic: {
      type: Boolean,
      default: false,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
    },
    timeLimit: {
      type: Number,
      min: [1, 'Time limit must be at least 1 minute'],
      max: [180, 'Time limit cannot exceed 180 minutes'],
    },
    passingScore: {
      type: Number,
      required: true,
      min: [0, 'Passing score cannot be negative'],
      max: [100, 'Passing score cannot exceed 100'],
      default: 70,
    },
    attempts: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      score: {
        type: Number,
        required: true,
      },
      completedAt: {
        type: Date,
        required: true,
      },
      timeSpent: {
        type: Number,
        required: true,
      },
      answers: [{
        questionIndex: {
          type: Number,
          required: true,
        },
        selectedOption: {
          type: Number,
          required: true,
        },
        isCorrect: {
          type: Boolean,
          required: true,
        },
        timeSpent: {
          type: Number,
          required: true,
        },
      }],
    }],
    analytics: {
      totalAttempts: {
        type: Number,
        default: 0,
      },
      averageScore: {
        type: Number,
        default: 0,
      },
      averageTimeSpent: {
        type: Number,
        default: 0,
      },
      completionRate: {
        type: Number,
        default: 0,
      },
      questionStats: [{
        questionIndex: {
          type: Number,
          required: true,
        },
        correctAnswers: {
          type: Number,
          default: 0,
        },
        totalAttempts: {
          type: Number,
          default: 0,
        },
        averageTimeSpent: {
          type: Number,
          default: 0,
        },
      }],
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Middleware to update analytics when a new attempt is added
quizSchema.pre('save', async function(next) {
  if (this.isModified('attempts')) {
    const quiz = this as IQuiz;
    const attempts = quiz.attempts;
    const totalAttempts = attempts.length;

    if (totalAttempts > 0) {
      // Calculate overall analytics
      const averageScore = attempts.reduce((sum, att) => sum + att.score, 0) / totalAttempts;
      const averageTimeSpent = attempts.reduce((sum, att) => sum + att.timeSpent, 0) / totalAttempts;
      const completedAttempts = attempts.filter(att => att.score >= quiz.passingScore).length;
      const completionRate = (completedAttempts / totalAttempts) * 100;

      // Calculate per-question statistics
      const questionStats = quiz.questions.map((_, index) => {
        const questionAttempts = attempts.map(att => att.answers[index]).filter(Boolean);
        const totalQuestionAttempts = questionAttempts.length;
        
        return {
          questionIndex: index,
          correctAnswers: questionAttempts.filter(ans => ans.isCorrect).length,
          totalAttempts: totalQuestionAttempts,
          averageTimeSpent: totalQuestionAttempts > 0
            ? questionAttempts.reduce((sum, ans) => sum + ans.timeSpent, 0) / totalQuestionAttempts
            : 0,
        };
      });

      // Update analytics
      quiz.analytics = {
        totalAttempts,
        averageScore,
        averageTimeSpent,
        completionRate,
        questionStats,
        lastUpdated: new Date(),
      };
    }
  }
  next();
});

// Create indexes for better query performance
quizSchema.index({ owner: 1, title: 1 });
quizSchema.index({ tags: 1 });
quizSchema.index({ isPublic: 1 });
quizSchema.index({ difficulty: 1 });

export default mongoose.model<IQuiz>('Quiz', quizSchema); 