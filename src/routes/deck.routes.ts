import express from 'express';
import {
  createDeck,
  getDecks,
  getDeck,
  updateDeck,
  deleteDeck,
  getPublicDecks,
  searchDecks,
} from '../controllers/deck.controller';
import {
  getCards,
  getDueCards,
} from '../controllers/card.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/public', getPublicDecks);

// Protected routes
router.use(protect);

router.route('/')
  .get(getDecks)
  .post(createDeck);

router.get('/search', searchDecks);

router.route('/:id')
  .get(getDeck)
  .put(updateDeck)
  .delete(deleteDeck);

// Card routes for a specific deck
router.route('/:deckId/cards')
  .get(getCards);
  // POST route removed - handled by card.routes.ts with proper multer middleware

router.get('/:deckId/cards/due', getDueCards);

export default router; 