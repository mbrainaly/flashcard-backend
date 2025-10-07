import express from 'express';
import {
  getAllDecks,
  getDeckById,
  updateDeck,
  deleteDeck,
  getAllCards,
  getCardById,
  updateCard,
  deleteCard,
  getAllQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  getAllNotes,
  getNoteById,
  updateNote,
  deleteNote,
  getContentStats
} from '../../controllers/admin/admin.content.controller';
import { protectAdmin } from '../../middleware/admin.auth.middleware';
import { requirePermissions } from '../../middleware/admin.permissions.middleware';

const router = express.Router();

// Apply admin authentication to all routes
router.use(protectAdmin);

// Deck Management Routes
router.get('/content/decks', requirePermissions(['content.read']), getAllDecks);
router.get('/content/decks/:id', requirePermissions(['content.read']), getDeckById);
router.put('/content/decks/:id', requirePermissions(['content.write']), updateDeck);
router.delete('/content/decks/:id', requirePermissions(['content.delete']), deleteDeck);

// Card Management Routes
router.get('/content/cards', requirePermissions(['content.read']), getAllCards);
router.get('/content/cards/:id', requirePermissions(['content.read']), getCardById);
router.put('/content/cards/:id', requirePermissions(['content.write']), updateCard);
router.delete('/content/cards/:id', requirePermissions(['content.delete']), deleteCard);

// Quiz Management Routes
router.get('/content/quizzes', requirePermissions(['content.read']), getAllQuizzes);
router.get('/content/quizzes/:id', requirePermissions(['content.read']), getQuizById);
router.put('/content/quizzes/:id', requirePermissions(['content.write']), updateQuiz);
router.delete('/content/quizzes/:id', requirePermissions(['content.delete']), deleteQuiz);

// Notes Management Routes
router.get('/content/notes', requirePermissions(['content.read']), getAllNotes);
router.get('/content/notes/:id', requirePermissions(['content.read']), getNoteById);
router.put('/content/notes/:id', requirePermissions(['content.write']), updateNote);
router.delete('/content/notes/:id', requirePermissions(['content.delete']), deleteNote);

// Content Statistics Route
router.get('/content/stats', requirePermissions(['content.read', 'analytics.read']), getContentStats);

export default router;
