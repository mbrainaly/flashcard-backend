import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  createCard,
  getCards,
  getDueCards,
  updateCard,
  deleteCard,
  reviewCard,
} from '../controllers/card.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Save to frontend public folder - go up one level from backend to reach frontend
    const uploadPath = path.join(process.cwd(), '..', 'frontend', 'public', 'uploads', 'cards');
    console.log('Upload path:', uploadPath); // Debug log
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    console.log('Generated filename:', filename); // Debug log
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|pdf|docx|txt/; // Allow documents
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      console.log(`Uploading file: ${file.originalname}, size: ${file.size} bytes`); // Log file size
      return cb(null, true);
    }
    cb(new Error('Only image and document files are allowed!'));
  }
});

// All routes are protected
router.use(protect);

// Routes for cards within a deck
router.route('/decks/:deckId/cards')
  .get(getCards)
  .post(upload.single('image'), createCard);

router.get('/decks/:deckId/cards/due', getDueCards);

// Routes for individual cards
router.route('/cards/:id')
  .put(upload.single('image'), updateCard)
  .delete(deleteCard);

router.post('/cards/:id/review', reviewCard);

export default router; 