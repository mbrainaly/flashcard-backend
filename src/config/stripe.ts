import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Use test key from environment variables or a placeholder for development
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

// Initialize Stripe with the secret key
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24.acacia', // Updated to match the expected version in TypeScript definitions
});

// Define subscription plans (these would match your Stripe products in a production environment)
export const SUBSCRIPTION_PLANS = {
  BASIC: {
    id: 'basic',
    name: 'Basic',
    price: 0,
    credits: 50,
    features: [
      'Access to basic flashcards',
      'Limited quiz generation',
      'Basic study tools'
    ]
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 15,
    priceId: 'price_test_pro', // This would be a real Stripe price ID in production
    credits: 200,
    features: [
      'Unlimited flashcards',
      'Advanced quiz generation',
      'Priority support',
      'No ads'
    ]
  },
  TEAM: {
    id: 'team',
    name: 'Team',
    price: 49,
    priceId: 'price_test_team', // This would be a real Stripe price ID in production
    credits: 500,
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Admin dashboard',
      'Usage analytics'
    ]
  }
};

export default stripe; 