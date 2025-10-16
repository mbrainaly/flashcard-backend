import express from 'express';
import { protect } from '../middleware/auth';
import {
  createStudySession,
  updateStudySession,
  getDeckStudySessions,
  getDeckStudyStats,
  getUserStudySessions
} from '../controllers/studySession.controller';

const router = express.Router();

// All routes are protected
router.use(protect);

// Study session routes
router.post('/', createStudySession);
router.put('/:id', updateStudySession);
router.get('/', getUserStudySessions);

// Deck-specific study session routes
router.get('/decks/:deckId/sessions', getDeckStudySessions);
router.get('/decks/:deckId/stats', getDeckStudyStats);

export default router;
