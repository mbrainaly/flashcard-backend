import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    default: ''
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  source: {
    type: {
      type: String,
      enum: ['pdf', 'text', 'url', 'manual'],
      default: 'manual'
    },
    name: {
      type: String,
      default: ''
    }
  },
  category: {
    type: String,
    default: 'General'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  wordCount: {
    type: Number,
    default: 0
  },
  readingTime: {
    type: Number,
    default: 0
  },
  generatedAt: {
    type: Date,
    default: null
  },
  viewCount: {
    type: Number,
    default: 0
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
});

// Pre-save middleware to calculate word count and reading time
noteSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    const words = this.content.split(/\s+/).filter(word => word.length > 0);
    this.wordCount = words.length;
    this.readingTime = Math.max(1, Math.ceil(words.length / 200)); // Average reading speed: 200 words per minute
  }
  next();
});

const Note = mongoose.model('Note', noteSchema);

export default Note; 