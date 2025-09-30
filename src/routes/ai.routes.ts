import express from 'express';
import multer from 'multer';
import path from 'path';
import s3Client from '../config/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { protect } from '../middleware/auth';
import {
  generateFlashcardsForDeck,
  analyzeContentForFlashcards,
  evaluateAnswer,
  generateQuizQuestion,
  explainFlashcard,
  analyzeQuizContent,
  generateQuiz,
  answerQuestion,
  explainConcept,
} from '../controllers/ai.controller';
import {
  generateProblems,
  checkAnswer
} from '../controllers/practice.controller'
import { getHomeworkHelp } from '../controllers/homework.controller';
import { analyzeDocument } from '../controllers/document.controller'

const router = express.Router();

// Configure multer for document uploads
const storage = multer.memoryStorage(); // Store files in memory

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit for documents
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /pdf|docx|doc|txt|rtf|jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.includes('pdf') || 
                    file.mimetype.includes('document') || 
                    file.mimetype.includes('text') ||
                    file.mimetype.includes('image');

    if (mimetype && extname) {
      console.log(`Processing document: ${file.originalname}, size: ${file.size} bytes`);
      return cb(null, true);
    }
    cb(new Error('Only document and image files (PDF, DOCX, TXT, JPG, PNG) are allowed!'));
  }
});

// Protected routes
router.use(protect);

// Route for uploading documents to S3
router.post('/upload-document', upload.single('document'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const uploadParams = {
      Bucket: 'wetransferv1',
      Key: `${Date.now()}-${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    res.status(200).json({ message: 'File uploaded successfully!' });
  } catch (error: any) {
    if (error.name === 'PayloadTooLargeError') {
      return res.status(413).json({ message: 'File size exceeds the limit.' });
    }
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Failed to upload document. Please try again.' });
  }
});

// Other routes
router.post('/analyze-content', analyzeContentForFlashcards);
router.post('/analyze-quiz-content', analyzeQuizContent);
router.post('/generate-flashcards', generateFlashcardsForDeck);
router.post('/evaluate-answer', evaluateAnswer);
router.post('/generate-quiz', generateQuizQuestion);
router.post('/explain', explainFlashcard);
router.post('/generate-quiz-complete', generateQuiz);
router.post('/flashcards/generate', generateFlashcardsForDeck);
router.post('/quiz/generate', generateQuizQuestion);
router.post('/explain-concept', explainConcept);
router.post('/answer-question', answerQuestion);

// Practice problem routes
router.post('/generate-problems', generateProblems)
router.post('/check-answer', checkAnswer)

// Homework help route
router.post('/homework-help', upload.single('file'), getHomeworkHelp);

// Document analysis route
router.post('/analyze-document', upload.single('file'), protect, analyzeDocument)

// PDF processing route with Gemini
router.post('/process-pdf', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Check if it's a PDF or supported document type
    if (!file.mimetype.includes('pdf') && !file.mimetype.includes('document')) {
      return res.status(400).json({ message: 'Only PDF and document files are supported.' });
    }

    // Import the PDF processing function
    const { processPDFWithClaude, generateNotesFromContent } = await import('../utils/ai');
    
    let content;
    if (file.mimetype === 'application/pdf') {
      // Process PDF directly with Claude Sonnet 4
      content = await processPDFWithClaude(file.buffer, file.mimetype);
    } else {
      // For other document types, you might need additional processing
      // For now, we'll return an error for unsupported types
      return res.status(400).json({ message: 'Currently only PDF files are supported for direct processing.' });
    }

    // Generate structured notes from the extracted content
    const notes = await generateNotesFromContent(content, req.body.topic);

    res.status(200).json({ 
      success: true,
      content: notes,
      originalContent: content
    });
  } catch (error: any) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process PDF. Please try again.',
      error: error.message 
    });
  }
})

export default router; 