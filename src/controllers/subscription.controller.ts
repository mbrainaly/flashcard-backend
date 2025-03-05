import { Request, Response } from 'express';
import stripe, { SUBSCRIPTION_PLANS } from '../config/stripe';
import User from '../models/User';

// @desc    Create a checkout session for subscription
// @route   POST /api/subscription/create-checkout-session
// @access  Private
export const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.body;
    const userId = req.user._id;

    console.log('Creating checkout session for user:', userId, 'plan:', planId);

    // Get the plan details
    let plan;
    switch (planId) {
      case 'pro':
        plan = SUBSCRIPTION_PLANS.PRO;
        break;
      case 'team':
        plan = SUBSCRIPTION_PLANS.TEAM;
        break;
      default:
        console.log('Invalid plan selected:', planId);
        res.status(400).json({ success: false, message: 'Invalid plan selected' });
        return;
    }

    // Get the user
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found:', userId);
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Ensure we have a valid frontend URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    console.log('Using frontend URL:', frontendUrl);

    console.log('Creating Stripe checkout session with plan:', plan.name);

    // For test environment, we'll create a simple checkout session
    // In production, you would use actual Stripe products and prices
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${plan.name} Plan`,
                description: `${plan.name} subscription plan with ${plan.credits} credits`,
              },
              unit_amount: plan.price * 100, // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${frontendUrl}/billing?success=true&plan=${planId}`,
        cancel_url: `${frontendUrl}/billing?canceled=true`,
        metadata: {
          userId: userId.toString(),
          planId: planId,
        },
      });

      console.log('Checkout session created:', session.id);
      res.status(200).json({ success: true, sessionId: session.id, url: session.url });
    } catch (stripeError) {
      console.error('Stripe error creating checkout session:', stripeError);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create Stripe checkout session',
        error: stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error'
      });
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create checkout session',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// @desc    Update user subscription after successful payment
// @route   POST /api/subscription/update-subscription
// @access  Private
export const updateSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.body;
    const userId = req.user._id;

    // Get the plan details
    let plan;
    switch (planId) {
      case 'basic':
        plan = SUBSCRIPTION_PLANS.BASIC;
        break;
      case 'pro':
        plan = SUBSCRIPTION_PLANS.PRO;
        break;
      case 'team':
        plan = SUBSCRIPTION_PLANS.TEAM;
        break;
      default:
        res.status(400).json({ success: false, message: 'Invalid plan selected' });
        return;
    }

    // Update user subscription
    const user = await User.findByIdAndUpdate(
      userId,
      {
        'subscription.plan': planId,
        'subscription.status': 'active',
        'subscription.currentPeriodEnd': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        'subscription.credits': plan.credits,
      },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      subscription: user.subscription,
      message: `Successfully upgraded to ${plan.name} plan`,
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to update subscription' });
  }
};

// @desc    Get user subscription details
// @route   GET /api/subscription
// @access  Private
export const getSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Get the plan details
    let planDetails;
    switch (user.subscription.plan) {
      case 'basic':
        planDetails = SUBSCRIPTION_PLANS.BASIC;
        break;
      case 'pro':
        planDetails = SUBSCRIPTION_PLANS.PRO;
        break;
      case 'team':
        planDetails = SUBSCRIPTION_PLANS.TEAM;
        break;
      default:
        planDetails = SUBSCRIPTION_PLANS.BASIC;
    }

    res.status(200).json({
      success: true,
      subscription: {
        ...user.subscription,
        planDetails,
      },
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to get subscription details' });
  }
}; 