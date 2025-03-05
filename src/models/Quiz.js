"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const quizSchema = new mongoose_1.Schema({
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
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    noteId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
                type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
});
// Middleware to update analytics when a new attempt is added
quizSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isModified('attempts')) {
            const quiz = this;
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
});
// Create indexes for better query performance
quizSchema.index({ owner: 1, title: 1 });
quizSchema.index({ tags: 1 });
quizSchema.index({ isPublic: 1 });
quizSchema.index({ difficulty: 1 });
exports.default = mongoose_1.default.model('Quiz', quizSchema);
