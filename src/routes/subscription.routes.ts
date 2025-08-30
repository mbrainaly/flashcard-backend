import express from 'express';
import { protect } from '../middleware/auth';
import {
  createCheckoutSession,
  updateSubscription,
  getSubscription,
  getPlans
} from '../controllers/subscription.controller';

const router = express.Router();

// All routes are protected and require authentication
router.use(protect);

// Get subscription details
router.get('/', getSubscription);
router.get('/plans', getPlans);

// Create checkout session
router.post('/create-checkout-session', createCheckoutSession);

// Update subscription after successful payment
router.post('/update-subscription', updateSubscription);

export default router; 