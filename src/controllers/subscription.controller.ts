import { Request, Response } from 'express';
import stripe from '../config/stripe';
import User from '../models/User';
import Plan from '../models/Plan';
import SubscriptionPlan from '../models/SubscriptionPlan';

// @desc    Create a checkout session for subscription
// @route   POST /api/subscription/create-checkout-session
// @access  Private
export const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.body;
    const userId = req.user._id;

    console.log('Creating checkout session for user:', userId, 'plan:', planId);

    // First, try to get the plan from the database
    let plan;
    let subscriptionPlan = null;

    try {
      subscriptionPlan = await SubscriptionPlan.findById(planId);
      if (subscriptionPlan) {
        plan = {
          id: subscriptionPlan._id.toString(),
          name: subscriptionPlan.name,
          price: subscriptionPlan.price.monthly,
          credits: subscriptionPlan.features.aiFlashcardCredits || 0,
          description: subscriptionPlan.description
        };
      }
    } catch (dbError) {
      console.log('Plan not found in database:', dbError);
    }

    // Only use database plans - no hardcoded fallback
    if (!plan) {
      console.log('Plan not found in database:', planId);
      res.status(400).json({ success: false, message: 'Plan not found. Please contact support.' });
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

    console.log('Creating checkout session with plan:', plan.name);

    // Check if this is a free plan (price = 0)
    if (plan.price === 0) {
      console.log('Free plan detected, assigning directly without Stripe checkout');
      
      // Update user subscription directly for free plans
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          'subscription.plan': planId,
          'subscription.status': 'active',
          'subscription.currentPeriodEnd': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for free plans
          'subscription.credits': plan.credits,
        },
        { new: true }
      );

      if (!updatedUser) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      // Return success response without Stripe session
      res.status(200).json({ 
        success: true, 
        message: `Successfully upgraded to ${plan.name} plan`,
        subscription: updatedUser.subscription,
        isFree: true // Flag to indicate this was a free plan upgrade
      });
      return;
    }

    // For paid plans, create or get Stripe product and price
    let stripePrice;
    
    try {
      // Check if we have a stored Stripe price ID for this plan
      if (subscriptionPlan?.metadata?.stripePriceId) {
        // Use existing Stripe price
        stripePrice = subscriptionPlan.metadata.stripePriceId;
        console.log('Using existing Stripe price:', stripePrice);
      } else {
        // Create new Stripe product and price
        console.log('Creating new Stripe product and price for plan:', plan.name);
        
        const product = await stripe.products.create({
          name: `${plan.name} Plan`,
          description: plan.description || `${plan.name} subscription plan`,
          metadata: {
            planId: planId,
            source: 'admin_panel'
          }
        });

        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(plan.price * 100), // Convert to cents
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
          metadata: {
            planId: planId,
            source: 'admin_panel'
          }
        });

        stripePrice = price.id;

        // Update the subscription plan with Stripe IDs
        if (subscriptionPlan) {
          await SubscriptionPlan.findByIdAndUpdate(planId, {
            $set: {
              'metadata.stripeProductId': product.id,
              'metadata.stripePriceId': price.id
            }
          });
        }

        console.log('Created Stripe product:', product.id, 'and price:', price.id);
      }

      // Create checkout session with the Stripe price
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePrice,
            quantity: 1,
          },
        ],
        mode: 'subscription', // Changed to subscription mode for recurring payments
        success_url: `${frontendUrl}/billing?success=true&plan=${planId}`,
        cancel_url: `${frontendUrl}/billing?canceled=true`,
        metadata: {
          userId: userId.toString(),
          planId: planId,
        },
        customer_email: user.email, // Pre-fill customer email
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

    // First, try to get the plan from the database
    let plan;
    let subscriptionPlan = null;

    try {
      subscriptionPlan = await SubscriptionPlan.findById(planId);
      if (subscriptionPlan) {
        plan = {
          id: subscriptionPlan._id.toString(),
          name: subscriptionPlan.name,
          price: subscriptionPlan.price.monthly,
          credits: subscriptionPlan.features.aiFlashcardCredits || 0
        };
      }
    } catch (dbError) {
      console.log('Plan not found in database:', dbError);
    }

    // Only use database plans - no hardcoded fallback
    if (!plan) {
      console.log('Plan not found in database:', planId);
      res.status(400).json({ success: false, message: 'Plan not found. Please contact support.' });
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

    // Get the plan details - first try database, then fallback to hardcoded
    let planDetails;
    let subscriptionPlan;
    
    try {
      subscriptionPlan = await SubscriptionPlan.findById(user.subscription.plan);
      if (subscriptionPlan) {
        planDetails = {
          id: subscriptionPlan._id.toString(),
          name: subscriptionPlan.name,
          price: subscriptionPlan.price.monthly,
          selectedFeatures: subscriptionPlan.selectedFeatures || [],
          features: [
            `Up to ${subscriptionPlan.features.maxDecks === 999999 ? 'Unlimited' : subscriptionPlan.features.maxDecks} decks`,
            `${subscriptionPlan.features.aiFlashcardCredits === 999999 ? 'Unlimited' : subscriptionPlan.features.aiFlashcardCredits} AI flashcard credits`,
            `${subscriptionPlan.features.aiQuizCredits === 999999 ? 'Unlimited' : subscriptionPlan.features.aiQuizCredits} AI quiz credits`,
            `${subscriptionPlan.features.aiNotesCredits === 999999 ? 'Unlimited' : subscriptionPlan.features.aiNotesCredits} AI notes credits`,
            `${subscriptionPlan.features.aiAssistantCredits === 999999 ? 'Unlimited' : subscriptionPlan.features.aiAssistantCredits} AI assistant credits`
          ].filter(Boolean)
        };
      }
    } catch (dbError) {
      console.log('Plan not found in database:', dbError);
    }

    // Only use database plans - no hardcoded fallback
    if (!planDetails) {
      console.log('Plan not found in database for user:', userId, 'plan:', user.subscription.plan);
      res.status(400).json({ 
        success: false, 
        message: 'Subscription plan not found. Please contact support.' 
      });
      return;
    }

    // Calculate credits based on the database plan
    const credits = subscriptionPlan?.features?.aiFlashcardCredits === 999999 ? 999999 : (subscriptionPlan?.features?.aiFlashcardCredits || 0);

    res.status(200).json({
      success: true,
      subscription: {
        ...user.subscription,
        credits, // Use calculated credits instead of stored credits
        planDetails,
      },
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to get subscription details' });
  }
}; 

// @desc    Get available plans from DB (fallback to config)
// @route   GET /api/subscription/plans
// @access  Private
export const getPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch active subscription plans from database
    const subscriptionPlans = await SubscriptionPlan.find({ 
      'visibility.isActive': true,
      'visibility.isPublic': true 
    })
    .sort({ 'metadata.sortOrder': 1 })
    .lean();

    if (subscriptionPlans.length > 0) {
      // Transform SubscriptionPlan data to match frontend Plan interface
      const plans = subscriptionPlans.map(plan => ({
        id: plan._id.toString(),
        name: plan.name,
        price: plan.price.yearly && plan.price.yearly > 0 
          ? { monthly: plan.price.monthly, yearly: plan.price.yearly }
          : plan.price.monthly,
        monthlyCredits: plan.features.aiFlashcardCredits || 0,
        allowDocuments: true, // All plans allow documents
        allowYoutubeAnalyze: true, // All plans allow YouTube analysis
        allowAIFlashcards: plan.features.aiFlashcardCredits > 0,
        allowAIStudyAssistant: plan.features.aiAssistantCredits > 0,
        monthlyQuizLimit: plan.features.aiQuizCredits === 999999 ? null : plan.features.aiQuizCredits,
        monthlyNotesLimit: plan.features.aiNotesCredits === 999999 ? null : plan.features.aiNotesCredits,
        features: [
          `Up to ${plan.features.maxDecks === 999999 ? 'Unlimited' : plan.features.maxDecks} decks`,
          `${plan.features.aiFlashcardCredits === 999999 ? 'Unlimited' : plan.features.aiFlashcardCredits} AI flashcard credits`,
          `${plan.features.aiQuizCredits === 999999 ? 'Unlimited' : plan.features.aiQuizCredits} AI quiz credits`,
          `${plan.features.aiNotesCredits === 999999 ? 'Unlimited' : plan.features.aiNotesCredits} AI notes credits`,
          `${plan.features.aiAssistantCredits === 999999 ? 'Unlimited' : plan.features.aiAssistantCredits} AI assistant credits`
        ].filter(Boolean),
        isPopular: plan.metadata?.badge?.toLowerCase().includes('popular') || false
      }));

      res.status(200).json({ success: true, plans });
      return;
    }

    // No database plans found
    console.log('No subscription plans found in database');
    res.status(200).json({ 
      success: true, 
      plans: [],
      message: 'No subscription plans available. Please contact support.' 
    });
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({ success: false, message: 'Failed to load plans' });
  }
};