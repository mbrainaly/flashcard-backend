import express from 'express';
import { getUserCreditsStatus } from '../controllers/userCredits.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// All routes are protected
router.use(protect);

// @route   GET /api/user/credits
// @desc    Get user's current credit status for all features
// @access  Private
router.get('/credits', getUserCreditsStatus);

export default router;
