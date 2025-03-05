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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const cardSchema = new mongoose_1.Schema({
    deck: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true,
});
// Add indexes for better query performance
cardSchema.index({ deck: 1, status: 1 });
cardSchema.index({ nextReview: 1 });
cardSchema.index({ tags: 1 });
// Pre-save middleware to ensure nextReview is set
cardSchema.pre('save', function (next) {
    if (this.isNew) {
        this.nextReview = new Date();
    }
    next();
});
exports.default = mongoose_1.default.model('Card', cardSchema);
//# sourceMappingURL=Card.js.map