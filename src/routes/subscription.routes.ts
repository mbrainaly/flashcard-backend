import express from 'express';
import { protect } from '../middleware/auth';
import {
  createCheckoutSession,
  updateSubscription,
  getSubscription,
  getPlans
} from '../controllers/subscription.controller';

const router = express.Router();

// Public routes (no authentication required)
router.get('/plans', getPlans);

// Protected routes (require authentication)
router.use(protect);

// Get subscription details
router.get('/', getSubscription);

// Create checkout session
router.post('/create-checkout-session', createCheckoutSession);

// Update subscription after successful payment
router.post('/update-subscription', updateSubscription);

export default router; 