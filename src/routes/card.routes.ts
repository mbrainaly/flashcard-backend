import express from 'express';
import multer from 'multer';
import path from 'path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import s3Client from '../config/s3';
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

// Configure multer memory storage (we will upload to S3)
const storage = multer.memoryStorage();

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
  .post(upload.single('image'), async (req, res, next) => {
    try {
      if (req.file) {
        const bucket = process.env.AWS_S3_BUCKET as string;
        const key = `uploads/cards/${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(req.file.originalname)}`;
        await s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          ACL: 'public-read',
        }));
        // attach public URL to request for controller to save
        const baseUrl = process.env.AWS_CDN_BASE_URL || `https://${bucket}.s3.amazonaws.com`;
        (req as any).uploadedImageUrl = `${baseUrl}/${key}`;
      }
      next();
    } catch (e) {
      console.error('S3 upload error:', e);
      res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
  }, createCard);

router.get('/decks/:deckId/cards/due', getDueCards);

// Routes for individual cards
router.route('/cards/:id')
  .put(upload.single('image'), async (req, res, next) => {
    try {
      if (req.file) {
        const bucket = process.env.AWS_S3_BUCKET as string;
        const key = `uploads/cards/${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(req.file.originalname)}`;
        await s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          ACL: 'public-read',
        }));
        const baseUrl = process.env.AWS_CDN_BASE_URL || `https://${bucket}.s3.amazonaws.com`;
        (req as any).uploadedImageUrl = `${baseUrl}/${key}`;
      }
      next();
    } catch (e) {
      console.error('S3 upload error:', e);
      res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
  }, updateCard)
  .delete(deleteCard);

router.post('/cards/:id/review', reviewCard);

export default router; 