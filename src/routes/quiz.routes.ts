import express from 'express';
import {
  createQuiz,
  getQuizzes,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  submitQuizAttempt,
  getPublicQuizzes,
  searchQuizzes,
  generateQuiz
} from '../controllers/quiz.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/public', getPublicQuizzes);

// Protected routes
router.use(protect);

// Notes quiz routes (place these before generic routes to avoid conflicts)
router.post('/notes/:id/generate', generateQuiz);
router.get('/notes/:id', getQuiz);
router.post('/notes/:id/submit', submitQuizAttempt);

// General quiz routes
router.route('/')
  .get(getQuizzes)
  .post(createQuiz);

router.get('/search', searchQuizzes);

router.route('/:id')
  .get(getQuiz)
  .put(updateQuiz)
  .delete(deleteQuiz);

// Quiz submission route
router.post('/:id/submit', submitQuizAttempt);

export default router; 