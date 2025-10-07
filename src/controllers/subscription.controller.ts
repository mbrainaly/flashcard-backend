import { Request, Response } from 'express';
import stripe, { SUBSCRIPTION_PLANS } from '../config/stripe';
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
          credits: subscriptionPlan.limits.monthlyAiGenerations || 50,
          description: subscriptionPlan.description
        };
      }
    } catch (dbError) {
      console.log('Plan not found in database, checking hardcoded plans...');
    }

    // Fallback to hardcoded plans if not found in database
    if (!plan) {
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
          credits: subscriptionPlan.limits.monthlyAiGenerations || 50
        };
      }
    } catch (dbError) {
      console.log('Plan not found in database, checking hardcoded plans...');
    }

    // Fallback to hardcoded plans if not found in database
    if (!plan) {
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
          features: [
            `Up to ${subscriptionPlan.features.maxDecks === 999999 ? 'Unlimited' : subscriptionPlan.features.maxDecks} decks`,
            `Up to ${subscriptionPlan.features.maxCards === 999999 ? 'Unlimited' : subscriptionPlan.features.maxCards} cards per deck`,
            `${subscriptionPlan.features.maxStorage >= 1024 ? Math.round(subscriptionPlan.features.maxStorage / 1024) + 'GB' : subscriptionPlan.features.maxStorage + 'MB'} storage`,
            `${subscriptionPlan.limits.dailyAiGenerations} AI generations per day`,
            `${subscriptionPlan.limits.monthlyAiGenerations === 999999 ? 'Unlimited' : subscriptionPlan.limits.monthlyAiGenerations} AI generations per month`,
            ...(subscriptionPlan.features.offlineAccess ? ['Offline access'] : []),
            ...(subscriptionPlan.features.prioritySupport ? ['Priority support'] : []),
            ...(subscriptionPlan.features.advancedAnalytics ? ['Advanced analytics'] : [])
          ].filter(Boolean)
        };
      }
    } catch (dbError) {
      console.log('Plan not found in database, using hardcoded plan details...');
    }

    // Fallback to hardcoded plans
    if (!planDetails) {
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
    }

    // Calculate credits based on the plan
    let credits = 50; // Default fallback
    
    if (subscriptionPlan) {
      // Use credits from database plan
      credits = subscriptionPlan.features.maxAiGenerations === 999999 ? 999999 : subscriptionPlan.features.maxAiGenerations;
    } else {
      // Fallback for hardcoded plans
      switch (user.subscription.plan) {
        case 'basic':
          credits = 50;
          break;
        case 'pro':
          credits = 200;
          break;
        case 'team':
          credits = 500;
          break;
        default:
          credits = 50;
      }
    }

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
        price: plan.price.monthly,
        monthlyCredits: plan.limits.monthlyAiGenerations || 50,
        allowDocuments: plan.features.maxStorage > 0,
        allowYoutubeAnalyze: plan.features.advancedAnalytics,
        allowAIFlashcards: plan.features.maxAiGenerations > 0,
        allowAIStudyAssistant: plan.features.prioritySupport,
        monthlyQuizLimit: plan.limits.monthlyAiGenerations === 999999 ? null : plan.limits.monthlyAiGenerations,
        monthlyNotesLimit: plan.limits.monthlyAiGenerations === 999999 ? null : Math.floor(plan.limits.monthlyAiGenerations / 2),
        features: [
          `Up to ${plan.features.maxDecks === 999999 ? 'Unlimited' : plan.features.maxDecks} decks`,
          `Up to ${plan.features.maxCards === 999999 ? 'Unlimited' : plan.features.maxCards} cards per deck`,
          `${plan.features.maxStorage >= 1024 ? Math.round(plan.features.maxStorage / 1024) + 'GB' : plan.features.maxStorage + 'MB'} storage`,
          `${plan.limits.dailyAiGenerations} AI generations per day`,
          `${plan.limits.monthlyAiGenerations === 999999 ? 'Unlimited' : plan.limits.monthlyAiGenerations} AI generations per month`,
          `${plan.limits.concurrentSessions} concurrent session${plan.limits.concurrentSessions > 1 ? 's' : ''}`,
          `${plan.limits.fileUploadSize}MB file upload limit`,
          ...(plan.features.offlineAccess ? ['Offline access'] : []),
          ...(plan.features.prioritySupport ? ['Priority support'] : []),
          ...(plan.features.advancedAnalytics ? ['Advanced analytics'] : []),
          ...(plan.features.customBranding ? ['Custom branding'] : []),
          ...(plan.features.apiAccess ? ['API access'] : []),
          ...(plan.features.exportFeatures ? ['Export features'] : []),
          ...(plan.features.collaborativeDecks ? ['Collaborative decks'] : []),
          ...(plan.features.customCategories ? ['Custom categories'] : [])
        ].filter(Boolean)
      }));

      res.status(200).json({ success: true, plans });
      return;
    }

    // Fallback to hardcoded plans if no database plans exist
    const fallback = [
      {
        id: SUBSCRIPTION_PLANS.BASIC.id,
        name: SUBSCRIPTION_PLANS.BASIC.name,
        price: SUBSCRIPTION_PLANS.BASIC.price,
        monthlyCredits: SUBSCRIPTION_PLANS.BASIC.credits,
        allowDocuments: false,
        allowYoutubeAnalyze: false,
        allowAIFlashcards: false,
        allowAIStudyAssistant: false,
        monthlyQuizLimit: 3,
        monthlyNotesLimit: 3,
        features: [
          'Unlimited Non-AI Flashcards',
          '50 Credits / month',
          'No Document Uploading',
          'No YouTube Video URL Analyze',
          '3 Quiz Generation',
          '3 Notes Generation',
          'No AI Study Assistant',
        ],
      },
      {
        id: SUBSCRIPTION_PLANS.PRO.id,
        name: SUBSCRIPTION_PLANS.PRO.name,
        price: SUBSCRIPTION_PLANS.PRO.price,
        monthlyCredits: SUBSCRIPTION_PLANS.PRO.credits,
        allowDocuments: true,
        allowYoutubeAnalyze: true,
        allowAIFlashcards: true,
        allowAIStudyAssistant: true,
        monthlyQuizLimit: 50,
        monthlyNotesLimit: 50,
        features: [
          'Unlimited AI flashcards',
          '200 Credits / month',
          'Document Uploading',
          'YouTube Video URL Analyze',
          '50 Quiz Generation',
          '50 Notes Generation',
          'AI Study Assistant',
        ],
      },
      {
        id: SUBSCRIPTION_PLANS.TEAM.id,
        name: SUBSCRIPTION_PLANS.TEAM.name,
        price: SUBSCRIPTION_PLANS.TEAM.price,
        monthlyCredits: SUBSCRIPTION_PLANS.TEAM.credits,
        allowDocuments: true,
        allowYoutubeAnalyze: true,
        allowAIFlashcards: true,
        allowAIStudyAssistant: true,
        monthlyQuizLimit: null,
        monthlyNotesLimit: null,
        features: [
          'Unlimited AI flashcards',
          '500 Credits / month',
          'Document Uploading',
          'YouTube Video URL Analyze',
          'Unlimited Quiz Generation',
          'Unlimited Notes Generation',
          'AI Study Assistant',
        ],
      },
    ];
    res.status(200).json({ success: true, plans: fallback });
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({ success: false, message: 'Failed to load plans' });
  }
};