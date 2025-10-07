import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Subscription from '../../models/Subscription';
import SubscriptionPlan from '../../models/SubscriptionPlan';
import Transaction from '../../models/Transaction';
import User from '../../models/User';
import { AuthenticatedRequest } from '../../middleware/admin.auth.middleware';
import { AVAILABLE_FEATURES, FEATURE_CATEGORIES } from '../../config/features';

// Subscription Management Controllers

// Helper function to generate features list from plan details
const generateFeaturesList = (planDetails: any): string[] => {
  if (!planDetails) return [];
  
  // If it's a legacy plan with simple features array
  if (Array.isArray(planDetails.features)) {
    return planDetails.features;
  }
  
  // If it has the new features object structure
  if (planDetails.features && typeof planDetails.features === 'object') {
    const features: string[] = [];
    
    // Add numeric features
    if (planDetails.features.maxDecks === 999999) {
      features.push('Unlimited Decks');
    } else if (planDetails.features.maxDecks > 0) {
      features.push(`Up to ${planDetails.features.maxDecks} decks`);
    }
    
    if (planDetails.features.maxCards === 999999) {
      features.push('Unlimited Cards');
    } else if (planDetails.features.maxCards > 0) {
      features.push(`Up to ${planDetails.features.maxCards} cards per deck`);
    }
    
    if (planDetails.features.maxAiGenerations === 999999) {
      features.push('Unlimited AI Generations');
    } else if (planDetails.features.maxAiGenerations > 0) {
      features.push(`${planDetails.features.maxAiGenerations} AI generations per month`);
    }
    
    if (planDetails.features.maxStorage > 0) {
      const storageDisplay = planDetails.features.maxStorage >= 1024 
        ? `${Math.round(planDetails.features.maxStorage / 1024)}GB storage`
        : `${planDetails.features.maxStorage}MB storage`;
      features.push(storageDisplay);
    }
    
    // Add boolean features
    if (planDetails.features.prioritySupport) features.push('Priority Support');
    if (planDetails.features.advancedAnalytics) features.push('Advanced Analytics');
    if (planDetails.features.customBranding) features.push('Custom Branding');
    if (planDetails.features.apiAccess) features.push('API Access');
    if (planDetails.features.exportFeatures) features.push('Export Features');
    if (planDetails.features.collaborativeDecks) features.push('Collaborative Decks');
    if (planDetails.features.offlineAccess) features.push('Offline Access');
    if (planDetails.features.customCategories) features.push('Custom Categories');
    
    return features;
  }
  
  return [];
};

export const getAllSubscriptions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      status, 
      planId, 
      search, 
      dateFrom, 
      dateTo,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build aggregation pipeline to get users with subscriptions
    let pipeline: any[] = [
      // Match users who have subscriptions (not basic or empty)
      {
        $match: {
          'subscription.plan': { $exists: true, $ne: null }
        }
      }
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Add status filter
    if (status) {
      pipeline.push({
        $match: {
          'subscription.status': status
        }
      });
    }

    // Add plan filter (match by plan ID or plan name)
    if (planId) {
      pipeline.push({
        $match: {
          $or: [
            { 'subscription.plan': planId },
            { 'subscription.plan': { $regex: planId, $options: 'i' } }
          ]
        }
      });
    }

    // Add date filter
    if (dateFrom || dateTo) {
      const dateFilter: any = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom as string);
      if (dateTo) dateFilter.$lte = new Date(dateTo as string);
      pipeline.push({
        $match: {
          createdAt: dateFilter
        }
      });
    }

    // Add sorting
    const sortField = sortBy === 'createdAt' ? 'createdAt' : `subscription.${sortBy}`;
    const sortObj: any = {};
    sortObj[sortField] = sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: sortObj });

    // Get total count for pagination
    const totalPipeline = [...pipeline];
    totalPipeline.push({ $count: 'total' });
    const totalResult = await User.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: limitNum });

    // Execute aggregation
    const users = await User.aggregate(pipeline);

    // Get all unique plan IDs to fetch plan details
    const planIds = [...new Set(users.map(user => user.subscription.plan))];
    const plans = await SubscriptionPlan.find({ 
      $or: [
        { _id: { $in: planIds.filter(id => id && id.match(/^[0-9a-fA-F]{24}$/)) } },
        { name: { $in: planIds } }
      ]
    }).lean();

    // Create a plan lookup map
    const planMap = new Map();
    plans.forEach(plan => {
      planMap.set(plan._id.toString(), plan);
      planMap.set(plan.name.toLowerCase(), plan);
    });

    // Format subscriptions to match frontend interface
    const formattedSubscriptions = users.map(user => {
      // Try to find the plan by ID first, then by name
      let planDetails = planMap.get(user.subscription.plan);
      if (!planDetails) {
        planDetails = planMap.get(user.subscription.plan.toLowerCase());
      }
      
      // Fallback plan details for legacy plans
      if (!planDetails) {
        const legacyPlans = {
          basic: { name: 'Basic', price: { monthly: 0 }, features: [] },
          pro: { name: 'Pro', price: { monthly: 19.99 }, features: [] },
          team: { name: 'Team', price: { monthly: 49.99 }, features: [] }
        };
        planDetails = legacyPlans[user.subscription.plan as keyof typeof legacyPlans] || 
                     { name: 'Unknown Plan', price: { monthly: 0 }, features: [] };
      }

      return {
        _id: user._id,
        user: {
          name: user.name,
          email: user.email,
          avatar: user.avatar
        },
        plan: {
          name: planDetails.name,
          price: planDetails.price?.monthly || 0,
          interval: 'monthly' as const,
          features: generateFeaturesList(planDetails)
        },
        status: user.subscription.status || 'active',
        currentPeriodStart: user.createdAt,
        currentPeriodEnd: user.subscription.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        trialEnd: undefined,
        createdAt: user.createdAt,
        lastPayment: user.subscription.plan !== 'basic' ? {
          amount: planDetails.price?.monthly || 0,
          date: user.subscription.currentPeriodEnd || user.createdAt,
          status: 'succeeded' as const
        } : undefined
      };
    });

    res.json({
      success: true,
      data: formattedSubscriptions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions'
    });
  }
};

export const getSubscriptionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findById(id)
      .populate('userId', 'name email avatar createdAt')
      .populate('planId')
      .lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Get recent transactions for this subscription
    const recentTransactions = await Transaction.find({ subscriptionId: id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get usage analytics
    const usageAnalytics = {
      currentUsage: subscription.usage,
      limits: subscription.limits,
      usagePercentage: {
        decks: subscription.limits.maxDecks > 0 ? (subscription.usage.decksCreated / subscription.limits.maxDecks) * 100 : 0,
        cards: subscription.limits.maxCards > 0 ? (subscription.usage.cardsCreated / subscription.limits.maxCards) * 100 : 0,
        aiGenerations: subscription.limits.maxAiGenerations > 0 ? (subscription.usage.aiGenerations / subscription.limits.maxAiGenerations) * 100 : 0,
        storage: subscription.limits.maxStorage > 0 ? (subscription.usage.storageUsed / subscription.limits.maxStorage) * 100 : 0
      }
    };

    res.json({
      success: true,
      data: {
        subscription,
        recentTransactions,
        usageAnalytics
      }
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription'
    });
  }
};

export const updateSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Find the user by ID and update their subscription
    const user = await User.findById(id);
    if (!user || !user.subscription) {
      return res.status(404).json({
        success: false,
        message: 'User subscription not found'
      });
    }

    // Update subscription fields
    if (updateData.status) {
      user.subscription.status = updateData.status;
    }
    if (updateData.currentPeriodEnd) {
      user.subscription.currentPeriodEnd = new Date(updateData.currentPeriodEnd);
    }
    if (updateData.cancelAtPeriodEnd !== undefined) {
      user.subscription.cancelAtPeriodEnd = updateData.cancelAtPeriodEnd;
    }

    // Add admin note if provided
    if (updateData.notes) {
      if (!user.subscription.adminNotes) {
        user.subscription.adminNotes = [];
      }
      user.subscription.adminNotes.push({
        adminId: admin._id,
        adminName: admin.name,
        note: updateData.notes,
        timestamp: new Date()
      });
    }

    await user.save();

    // Get plan details for response
    let planDetails = null;
    if (user.subscription.plan) {
      planDetails = await SubscriptionPlan.findOne({
        $or: [
          { _id: user.subscription.plan },
          { name: user.subscription.plan }
        ]
      }).lean();
      
      // Fallback for legacy plans
      if (!planDetails) {
        const legacyPlans = {
          basic: { name: 'Basic', price: { monthly: 0 } },
          pro: { name: 'Pro', price: { monthly: 19.99 } },
          team: { name: 'Team', price: { monthly: 49.99 } }
        };
        planDetails = legacyPlans[user.subscription.plan as keyof typeof legacyPlans] || 
                     { name: user.subscription.plan, price: { monthly: 0 } };
      }
    }

    // Format response to match frontend interface
    const formattedSubscription = {
      _id: user._id,
      user: {
        name: user.name,
        email: user.email,
        avatar: user.avatar
      },
      plan: {
        name: planDetails?.name || 'Unknown Plan',
        price: planDetails?.price?.monthly || 0,
        interval: 'monthly',
        features: generateFeaturesList(planDetails)
      },
      status: user.subscription.status || 'active',
      currentPeriodStart: user.createdAt,
      currentPeriodEnd: user.subscription.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd || false,
      trialEnd: undefined,
      createdAt: user.createdAt,
      lastPayment: undefined
    };

    res.json({
      success: true,
      data: formattedSubscription,
      message: 'Subscription updated successfully'
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription'
    });
  }
};

export const deleteSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Find the user by ID and remove their subscription
    const user = await User.findById(id);
    if (!user || !user.subscription) {
      return res.status(404).json({
        success: false,
        message: 'User subscription not found'
      });
    }

    // Store user info before deletion for response
    const userInfo = {
      name: user.name,
      email: user.email
    };

    // Remove subscription from user
    user.subscription = undefined;
    await user.save();

    res.json({
      success: true,
      message: `Subscription deleted successfully for ${userInfo.name} (${userInfo.email})`
    });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subscription'
    });
  }
};

export const cancelSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, cancelAtPeriodEnd = true } = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    const updateData: any = {
      cancelAtPeriodEnd,
      cancelReason: reason,
      $push: {
        notes: {
          adminId: admin._id,
          adminName: admin.name,
          note: `Subscription cancelled by admin: ${reason || 'No reason provided'}`,
          timestamp: new Date()
        }
      }
    };

    // If immediate cancellation, set status and cancelled date
    if (!cancelAtPeriodEnd) {
      updateData.status = 'cancelled';
      updateData.cancelledAt = new Date();
    }

    const subscription = await Subscription.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )
      .populate('userId', 'name email')
      .populate('planId')
      .lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      data: subscription,
      message: cancelAtPeriodEnd ? 'Subscription will be cancelled at period end' : 'Subscription cancelled immediately'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};

// Plan Management Controllers

export const getAllPlans = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isActive, isPublic, search, sortBy = 'metadata.sortOrder', sortOrder = 'asc' } = req.query;

    // Build filter
    const filter: any = {};
    if (isActive !== undefined) filter['visibility.isActive'] = isActive === 'true';
    if (isPublic !== undefined) filter['visibility.isPublic'] = isPublic === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const plans = await SubscriptionPlan.find(filter)
      .sort(sort)
      .populate('createdBy.adminId', 'name email')
      .populate('lastModifiedBy.adminId', 'name email')
      .lean();

    // Get subscription counts for each plan
    const planIds = plans.map(plan => plan._id);
    const subscriptionCounts = await Subscription.aggregate([
      { $match: { planId: { $in: planIds } } },
      { $group: { _id: '$planId', count: { $sum: 1 } } }
    ]);

    // Format plans to match frontend interface
    const formattedPlans = plans.map(plan => {
      const countData = subscriptionCounts.find(sc => sc._id.toString() === plan._id.toString());
      
      // Convert features object to string array for frontend
      const featuresArray = [];
      if (plan.features.maxDecks === -1) {
        featuresArray.push('Unlimited decks');
      } else if (plan.features.maxDecks > 0) {
        featuresArray.push(`Up to ${plan.features.maxDecks} decks`);
      }
      
      if (plan.features.maxCards === -1) {
        featuresArray.push('Unlimited cards per deck');
      } else if (plan.features.maxCards > 0) {
        featuresArray.push(`Up to ${plan.features.maxCards} cards per deck`);
      }
      
      if (plan.features.maxStorage > 0) {
        const storageGB = plan.features.maxStorage >= 1024 ? `${Math.round(plan.features.maxStorage / 1024)}GB` : `${plan.features.maxStorage}MB`;
        featuresArray.push(`${storageGB} storage`);
      }
      
      if (plan.features.prioritySupport) featuresArray.push('Priority support');
      if (plan.features.advancedAnalytics) featuresArray.push('Advanced analytics');
      if (plan.features.customBranding) featuresArray.push('Custom branding');
      if (plan.features.apiAccess) featuresArray.push('API access');
      if (plan.features.exportFeatures) featuresArray.push('Export features');
      if (plan.features.collaborativeDecks) featuresArray.push('Collaborative decks');
      if (plan.features.offlineAccess) featuresArray.push('Offline access');
      if (plan.features.customCategories) featuresArray.push('Custom categories');

      return {
        _id: plan._id,
        name: plan.name,
        description: plan.description,
        price: plan.price.monthly, // Default to monthly, frontend will handle interval selection
        interval: 'monthly' as const,
        features: featuresArray,
        limits: {
          decks: plan.features.maxDecks === -1 ? 'unlimited' : plan.features.maxDecks,
          cards: plan.features.maxCards === -1 ? 'unlimited' : plan.features.maxCards,
          storage: plan.features.maxStorage >= 1024 ? `${Math.round(plan.features.maxStorage / 1024)}GB` : `${plan.features.maxStorage}MB`,
          support: plan.features.prioritySupport ? 'Priority' : 'Email'
        },
        isActive: plan.visibility.isActive,
        isPopular: plan.metadata.badge === 'Most Popular' || plan.metadata.badge === 'Best Value',
        stripePriceId: plan.metadata.stripePriceId,
        subscriberCount: countData?.count || 0,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString()
      };
    });

    res.json({
      success: true,
      data: formattedPlans
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans'
    });
  }
};

export const createPlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const frontendData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Transform frontend data to backend model format
    const planData = {
      name: frontendData.name,
      description: frontendData.description,
      price: {
        monthly: frontendData.price.monthly,
        yearly: frontendData.price.yearly,
        currency: 'USD'
      },
      features: {
        maxDecks: frontendData.features.maxDecks,
        maxCards: frontendData.features.maxCards,
        maxAiGenerations: frontendData.features.maxAiGenerations,
        maxStorage: frontendData.features.maxStorage,
        prioritySupport: false, // Default value
        advancedAnalytics: false, // Default value
        customBranding: false, // Default value
        apiAccess: false, // Default value
        exportFeatures: false, // Default value
        collaborativeDecks: false, // Default value
        offlineAccess: true, // Default value
        customCategories: false // Default value
      },
      limits: {
        dailyAiGenerations: frontendData.limits.dailyAiGenerations,
        monthlyAiGenerations: frontendData.limits.monthlyAiGenerations,
        concurrentSessions: frontendData.limits.concurrentSessions,
        fileUploadSize: frontendData.limits.fileUploadSize
      },
      trial: {
        enabled: frontendData.trial.enabled,
        durationDays: frontendData.trial.durationDays,
        features: []
      },
      selectedFeatures: frontendData.selectedFeatures || [],
      visibility: {
        isActive: frontendData.isActive,
        isPublic: true
      },
      metadata: {
        color: '#3B82F6',
        icon: 'star',
        badge: frontendData.isPopular ? 'Most Popular' : undefined,
        sortOrder: 0
      },
      createdBy: {
        adminId: admin._id,
        name: admin.name,
        email: admin.email
      },
      lastModifiedBy: {
        adminId: admin._id,
        name: admin.name,
        email: admin.email
      },
      statistics: {
        activeSubscriptions: 0,
        totalRevenue: 0,
        conversionRate: 0,
        churnRate: 0
      }
    };

    const plan = new SubscriptionPlan(planData);
    await plan.save();

    // Return formatted data to match frontend interface
    const formattedPlan = {
      _id: plan._id,
      name: plan.name,
      description: plan.description,
      price: frontendData.price,
      interval: frontendData.interval,
      features: frontendData.features,
      limits: frontendData.limits,
      isActive: plan.visibility.isActive,
      isPopular: frontendData.isPopular,
      stripePriceId: plan.metadata.stripePriceId,
      subscriberCount: 0,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString()
    };

    res.status(201).json({
      success: true,
      data: formattedPlan,
      message: 'Subscription plan created successfully'
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription plan'
    });
  }
};

// Helper function to parse storage strings like "1GB", "500MB"
function parseStorageString(storage: string): number {
  const match = storage.match(/^(\d+(?:\.\d+)?)(GB|MB)$/i);
  if (!match) return 1024; // Default to 1GB in MB
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  return unit === 'GB' ? value * 1024 : value;
}

export const updatePlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const frontendData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Transform frontend data to backend model format
    const updateData = {
      name: frontendData.name,
      description: frontendData.description,
      price: {
        monthly: frontendData.price.monthly,
        yearly: frontendData.price.yearly,
        currency: 'USD'
      },
      features: {
        maxDecks: frontendData.features.maxDecks,
        maxCards: frontendData.features.maxCards,
        maxAiGenerations: frontendData.features.maxAiGenerations,
        maxStorage: frontendData.features.maxStorage,
        prioritySupport: false, // Default value
        advancedAnalytics: false, // Default value
        customBranding: false, // Default value
        apiAccess: false, // Default value
        exportFeatures: false, // Default value
        collaborativeDecks: false, // Default value
        offlineAccess: true, // Default value
        customCategories: false // Default value
      },
      limits: {
        dailyAiGenerations: frontendData.limits.dailyAiGenerations,
        monthlyAiGenerations: frontendData.limits.monthlyAiGenerations,
        concurrentSessions: frontendData.limits.concurrentSessions,
        fileUploadSize: frontendData.limits.fileUploadSize
      },
      trial: {
        enabled: frontendData.trial.enabled,
        durationDays: frontendData.trial.durationDays,
        features: []
      },
      selectedFeatures: frontendData.selectedFeatures || [],
      visibility: {
        isActive: frontendData.isActive,
        isPublic: true
      },
      metadata: {
        color: '#3B82F6',
        icon: 'star',
        badge: frontendData.isPopular ? 'Most Popular' : undefined,
        sortOrder: 0
      },
      lastModifiedBy: {
        adminId: admin._id,
        name: admin.name,
        email: admin.email
      }
    };

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    // Return formatted data to match frontend interface
    const formattedPlan = {
      _id: plan._id,
      name: plan.name,
      description: plan.description,
      price: frontendData.price,
      interval: frontendData.interval,
      features: frontendData.features,
      limits: frontendData.limits,
      isActive: plan.visibility.isActive,
      isPopular: frontendData.isPopular,
      stripePriceId: plan.metadata.stripePriceId,
      subscriberCount: 0, // Will be updated separately if needed
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString()
    };

    res.json({
      success: true,
      data: formattedPlan,
      message: 'Subscription plan updated successfully'
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription plan'
    });
  }
};

export const deletePlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if plan has active subscriptions
    const activeSubscriptions = await Subscription.countDocuments({ 
      planId: id, 
      status: { $in: ['active', 'trialing'] } 
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete plan. It has ${activeSubscriptions} active subscriptions.`
      });
    }

    const plan = await SubscriptionPlan.findByIdAndDelete(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    res.json({
      success: true,
      message: 'Subscription plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subscription plan'
    });
  }
};

// Billing Management Controllers

export const getSubscriptionOverview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get basic subscription statistics from User model
    const [
      totalSubscriptions,
      activeSubscriptions,
      cancelledSubscriptions,
      basicSubscriptions
    ] = await Promise.all([
      User.countDocuments({ 'subscription.plan': { $exists: true, $ne: null } }),
      User.countDocuments({ 'subscription.status': 'active' }),
      User.countDocuments({ 'subscription.status': { $in: ['cancelled', 'inactive'] } }),
      User.countDocuments({ 'subscription.plan': 'basic' })
    ]);

    // Calculate monthly revenue from active subscriptions
    const revenueAggregation = await User.aggregate([
      { $match: { 'subscription.status': 'active', 'subscription.plan': { $ne: 'basic' } } },
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get plan details to calculate revenue
    const planIds = revenueAggregation.map(item => item._id);
    const plans = await SubscriptionPlan.find({
      $or: [
        { _id: { $in: planIds.filter(id => id && id.match(/^[0-9a-fA-F]{24}$/)) } },
        { name: { $in: planIds } }
      ]
    }).lean();

    // Create plan lookup map
    const planMap = new Map();
    plans.forEach(plan => {
      planMap.set(plan._id.toString(), plan);
      planMap.set(plan.name.toLowerCase(), plan);
    });

    // Calculate monthly revenue
    let monthlyRevenue = 0;
    revenueAggregation.forEach(item => {
      let planDetails = planMap.get(item._id);
      if (!planDetails) {
        planDetails = planMap.get(item._id.toLowerCase());
      }
      
      // Fallback for legacy plans
      if (!planDetails) {
        const legacyPlans = {
          pro: { price: { monthly: 19.99 } },
          team: { price: { monthly: 49.99 } }
        };
        planDetails = legacyPlans[item._id as keyof typeof legacyPlans];
      }
      
      if (planDetails && planDetails.price) {
        monthlyRevenue += (planDetails.price.monthly || 0) * item.count;
      }
    });

    // Calculate churn rate (cancelled in last 30 days / total active at start of period)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const cancelledLast30Days = await User.countDocuments({
      'subscription.status': { $in: ['cancelled', 'inactive'] },
      updatedAt: { $gte: thirtyDaysAgo }
    });

    const churnRate = activeSubscriptions > 0 ? (cancelledLast30Days / activeSubscriptions) * 100 : 0;

    // Get subscription trend for last 12 months
    const subscriptionTrend = await User.aggregate([
      {
        $match: {
          'subscription.plan': { $exists: true, $ne: null },
          createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 12)) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          new: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $dateFromParts: {
                  year: '$_id.year',
                  month: '$_id.month',
                  day: '$_id.day'
                }
              }
            }
          },
          new: '$new',
          active: { $literal: 0 }, // Placeholder value
          cancelled: { $literal: 0 } // Placeholder value
        }
      }
    ]);

    // Get plan distribution
    const planDistribution = await User.aggregate([
      {
        $match: {
          'subscription.plan': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$subscription.plan',
          value: { $sum: 1 }
        }
      },
      { $sort: { value: -1 } }
    ]);

    // Format plan distribution with plan names and colors
    const formattedPlanDistribution = planDistribution.map(item => {
      let planDetails = planMap.get(item._id);
      if (!planDetails) {
        planDetails = planMap.get(item._id.toLowerCase());
      }
      
      // Fallback for legacy plans
      if (!planDetails) {
        const legacyPlans = {
          basic: { name: 'Basic', metadata: { color: '#A78BFA' } },
          pro: { name: 'Pro', metadata: { color: '#3B82F6' } },
          team: { name: 'Team', metadata: { color: '#10B981' } }
        };
        planDetails = legacyPlans[item._id as keyof typeof legacyPlans] || 
                     { name: item._id, metadata: { color: '#6B7280' } };
      }

      return {
        name: planDetails.name,
        value: item.value,
        color: planDetails.metadata?.color || '#3B82F6'
      };
    });

    // Get recent subscriptions from users
    const recentUsers = await User.find({ 'subscription.plan': { $exists: true, $ne: null } })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Format recent subscriptions to match frontend interface
    const formattedRecentSubscriptions = recentUsers.map(user => {
      let planDetails = planMap.get(user.subscription.plan);
      if (!planDetails) {
        planDetails = planMap.get(user.subscription.plan.toLowerCase());
      }
      
      // Fallback for legacy plans
      if (!planDetails) {
        const legacyPlans = {
          basic: { name: 'Basic', price: { monthly: 0 } },
          pro: { name: 'Pro', price: { monthly: 19.99 } },
          team: { name: 'Team', price: { monthly: 49.99 } }
        };
        planDetails = legacyPlans[user.subscription.plan as keyof typeof legacyPlans] || 
                     { name: user.subscription.plan, price: { monthly: 0 } };
      }

      return {
        _id: user._id,
        user: {
          name: user.name,
          email: user.email,
          avatar: user.avatar
        },
        plan: {
          name: planDetails.name,
          price: planDetails.price?.monthly || 0,
          interval: 'monthly',
          features: generateFeaturesList(planDetails)
        },
        status: user.subscription.status || 'active',
        currentPeriodStart: user.createdAt.toISOString(),
        currentPeriodEnd: (user.subscription.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).toISOString(),
        cancelAtPeriodEnd: false,
        trialEnd: undefined,
        createdAt: user.createdAt.toISOString(),
        lastPayment: undefined
      };
    });

    const overview = {
      totalSubscriptions,
      activeSubscriptions,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
      subscriptionTrend,
      planDistribution: formattedPlanDistribution,
      recentSubscriptions: formattedRecentSubscriptions
    };

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Error fetching subscription overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription overview'
    });
  }
};

// Get all transactions with filtering (based on user subscriptions)
export const getAllTransactions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      paymentMethod, 
      dateRange, 
      search 
    } = req.query;

    // Build user filter
    const userFilter: any = {
      'subscription.plan': { $exists: true }
    };
    
    // Date range filter
    if (dateRange) {
      const now = new Date();
      let startDate: Date;
      
      switch (dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      userFilter.$or = [
        { 'subscription.createdAt': { $gte: startDate } },
        { createdAt: { $gte: startDate } } // Fallback to user creation date
      ];
    }

    // Search filter
    if (search) {
      userFilter.$and = userFilter.$and || [];
      userFilter.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const [users, total] = await Promise.all([
      User.find(userFilter)
        .sort({ 'subscription.createdAt': -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .lean(),
      User.countDocuments(userFilter)
    ]);

    // Format user subscriptions as transactions
    const formattedTransactions = await Promise.all(
      users.map(async (user) => {
        let planDetails = null;
        
        // Try to get plan details
        if (mongoose.Types.ObjectId.isValid(user.subscription.plan)) {
          planDetails = await SubscriptionPlan.findById(user.subscription.plan).lean();
        }

        // Fallback plan names for legacy plans
        const planName = planDetails?.name || 
          (user.subscription.plan === 'basic' ? 'Basic Plan' :
           user.subscription.plan === 'pro' ? 'Pro Plan' :
           user.subscription.plan === 'team' ? 'Team Plan' : 'Unknown Plan');

        // Extract the correct price based on interval
        let planPrice = 0;
        if (planDetails?.price) {
          const interval = user.subscription.interval || 'monthly';
          planPrice = interval === 'yearly' ? planDetails.price.yearly : planDetails.price.monthly;
        } else {
          // Fallback for legacy plans
          planPrice = user.subscription.plan === 'basic' ? 9.99 :
                     user.subscription.plan === 'pro' ? 19.99 :
                     user.subscription.plan === 'team' ? 39.99 : 0;
        }

        // Map subscription status to transaction status
        let transactionStatus = 'succeeded';
        if (status) {
          // Filter by status if specified
          const mappedStatus = user.subscription.status === 'active' ? 'succeeded' : 
                              user.subscription.status === 'cancelled' ? 'failed' : 'pending';
          if (mappedStatus !== status) {
            return null; // Filter out non-matching statuses
          }
          transactionStatus = mappedStatus;
        } else {
          transactionStatus = user.subscription.status === 'active' ? 'succeeded' : 
                             user.subscription.status === 'cancelled' ? 'failed' : 'pending';
        }

        return {
          _id: user._id,
          user: {
            name: user.name || 'Unknown User',
            email: user.email || 'unknown@example.com'
          },
          subscription: {
            plan: planName,
            interval: user.subscription.interval || 'monthly'
          },
          amount: planPrice,
          currency: 'USD',
          status: transactionStatus,
          paymentMethod: {
            type: paymentMethod || 'card', // Default to card if no filter
            last4: '****', // Mock data
            brand: 'visa'
          },
          stripeTransactionId: `txn_${user._id.toString().slice(-8)}`,
          failureReason: user.subscription.status === 'cancelled' ? 'cancelled_by_user' : null,
          createdAt: user.subscription.createdAt?.toISOString() || user.createdAt.toISOString(),
          processedAt: user.subscription.createdAt?.toISOString() || user.createdAt.toISOString()
        };
      })
    );

    // Filter out null values (from status filtering)
    const validTransactions = formattedTransactions.filter(t => t !== null);

    res.json({
      success: true,
      data: validTransactions,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: validTransactions.length,
        pages: Math.ceil(validTransactions.length / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
};

// Helper function to map backend transaction status to frontend status
function mapTransactionStatus(backendStatus: string): 'succeeded' | 'failed' | 'pending' | 'refunded' {
  switch (backendStatus) {
    case 'completed':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'pending':
    case 'processing':
      return 'pending';
    case 'cancelled':
      return 'failed';
    default:
      return 'pending';
  }
}

export const getBillingOverview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dateRange = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get billing statistics from user subscriptions (using same logic as recent transactions)
    const usersWithSubscriptions = await User.find({
      'subscription.plan': { $exists: true }
    }).lean();

    // Calculate total revenue from subscriptions
    let totalRevenue = 0;
    let monthlyRecurringRevenue = 0;
    let activeSubscriptionsCount = 0;
    const paymentMethodsMap = new Map();

    for (const user of usersWithSubscriptions) {
      // Debug individual user subscription
      console.log('User subscription debug:', {
        userId: user._id,
        subscriptionStatus: user.subscription?.status,
        subscriptionPlan: user.subscription?.plan,
        subscriptionInterval: user.subscription?.interval
      });

      // Only count active subscriptions for revenue
      if (user.subscription?.status !== 'active') {
        continue;
      }

      activeSubscriptionsCount++;

      // Extract the correct price based on interval
      let planPrice = 0;
      
      // Try to get plan details if it's a MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(user.subscription.plan)) {
        const planDetails = await SubscriptionPlan.findById(user.subscription.plan).lean();
        if (planDetails?.price) {
          const interval = user.subscription.interval || 'monthly';
          planPrice = interval === 'yearly' ? planDetails.price.yearly : planDetails.price.monthly;
        }
      } else {
        // Fallback for legacy plans
        planPrice = user.subscription.plan === 'basic' ? 9.99 :
                   user.subscription.plan === 'pro' ? 19.99 :
                   user.subscription.plan === 'team' ? 39.99 : 0;
      }
      
      totalRevenue += planPrice;
      
      // For MRR, convert yearly to monthly
      if (user.subscription?.interval === 'yearly') {
        monthlyRecurringRevenue += planPrice / 12;
      } else {
        monthlyRecurringRevenue += planPrice;
      }

      // Mock payment method distribution (since we don't have real payment data)
      const paymentMethod = 'card'; // Default to card
      if (paymentMethodsMap.has(paymentMethod)) {
        paymentMethodsMap.set(paymentMethod, {
          count: paymentMethodsMap.get(paymentMethod).count + 1,
          amount: paymentMethodsMap.get(paymentMethod).amount + planPrice
        });
      } else {
        paymentMethodsMap.set(paymentMethod, { count: 1, amount: planPrice });
      }
    }

    // Convert payment methods map to array
    const paymentMethods = Array.from(paymentMethodsMap.entries()).map(([method, data]) => ({
      method,
      count: data.count || 0,
      amount: isFinite(data.amount) ? data.amount : 0
    }));

    // Ensure we have at least one payment method for the chart
    if (paymentMethods.length === 0) {
      paymentMethods.push({
        method: 'card',
        count: 0,
        amount: 0
      });
    }

    // Generate mock revenue growth data based on current subscriptions
    const revenueGrowth = [];
    const daysInRange = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < Math.min(daysInRange, 30); i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dailyRevenue = monthlyRecurringRevenue / 30; // Spread MRR across days
      
      const revenue = isFinite(dailyRevenue) ? Math.round(dailyRevenue * 100) / 100 : 0;
      const transactions = Math.floor(activeSubscriptionsCount / 30) || 1;
      
      revenueGrowth.push({
        date: date.toISOString().split('T')[0],
        revenue,
        transactions,
        failed: 0
      });
    }

    // Get recent subscription activities as "transactions"
    const recentSubscriptions = await User.find({
      'subscription.plan': { $exists: true },
      'subscription.createdAt': { $gte: startDate }
    })
      .sort({ 'subscription.createdAt': -1 })
      .limit(10)
      .lean();

    // Format recent subscriptions as transactions
    const recentTransactions = await Promise.all(
      recentSubscriptions.map(async (user) => {
        let planDetails = null;
        
        // Try to get plan details
        if (mongoose.Types.ObjectId.isValid(user.subscription.plan)) {
          planDetails = await SubscriptionPlan.findById(user.subscription.plan).lean();
        }

        // Fallback plan names for legacy plans
        const planName = planDetails?.name || 
          (user.subscription.plan === 'basic' ? 'Basic Plan' :
           user.subscription.plan === 'pro' ? 'Pro Plan' :
           user.subscription.plan === 'team' ? 'Team Plan' : 'Unknown Plan');

        // Extract the correct price based on interval
        let planPrice = 0;
        if (planDetails?.price) {
          const interval = user.subscription.interval || 'monthly';
          planPrice = interval === 'yearly' ? planDetails.price.yearly : planDetails.price.monthly;
        } else {
          // Fallback for legacy plans
          planPrice = user.subscription.plan === 'basic' ? 9.99 :
                     user.subscription.plan === 'pro' ? 19.99 :
                     user.subscription.plan === 'team' ? 39.99 : 0;
        }

        return {
          _id: user._id,
          user: {
            name: user.name || 'Unknown User',
            email: user.email || 'unknown@example.com'
          },
          subscription: {
            plan: planName,
            interval: user.subscription.interval || 'monthly'
          },
          amount: planPrice,
          currency: 'USD',
          status: user.subscription.status === 'active' ? 'succeeded' : 'pending',
          paymentMethod: {
            type: 'card',
            last4: '****', // Mock data
            brand: 'visa'
          },
          stripeTransactionId: `txn_${user._id.toString().slice(-8)}`,
          failureReason: null,
          createdAt: user.subscription.createdAt?.toISOString() || user.createdAt.toISOString(),
          processedAt: user.subscription.createdAt?.toISOString() || user.createdAt.toISOString()
        };
      })
    );

    // Debug logging
    console.log('Billing Overview Debug:', {
      usersWithSubscriptionsCount: usersWithSubscriptions.length,
      activeSubscriptionsCount,
      totalRevenue,
      monthlyRecurringRevenue,
      paymentMethodsCount: paymentMethods.length,
      revenueGrowthCount: revenueGrowth.length,
      recentTransactionsCount: recentTransactions.length
    });

    const billingOverview = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      monthlyRecurringRevenue: Math.round(monthlyRecurringRevenue * 100) / 100,
      failedPayments: 0, // No failed payments data available
      refundedAmount: 0, // No refund data available
      revenueGrowth,
      paymentMethods,
      recentTransactions
    };

    res.json({
      success: true,
      data: billingOverview
    });
  } catch (error) {
    console.error('Error fetching billing overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing overview'
    });
  }
};

export const processRefund = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { transactionId, amount, reason } = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Find the original transaction
    const originalTransaction = await Transaction.findById(transactionId);
    if (!originalTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (originalTransaction.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only refund completed transactions'
      });
    }

    // Validate refund amount
    const refundAmount = amount || originalTransaction.amount;
    if (refundAmount > originalTransaction.amount) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount cannot exceed original transaction amount'
      });
    }

    // Create refund transaction
    const refundTransaction = new Transaction({
      userId: originalTransaction.userId,
      subscriptionId: originalTransaction.subscriptionId,
      type: 'refund',
      status: 'completed',
      amount: -refundAmount, // Negative amount for refund
      currency: originalTransaction.currency,
      description: `Refund for transaction ${originalTransaction._id}`,
      paymentMethod: originalTransaction.paymentMethod,
      gateway: {
        provider: originalTransaction.gateway.provider,
        transactionId: `refund_${originalTransaction.gateway.transactionId}_${Date.now()}`,
        gatewayResponse: { refundReason: reason }
      },
      metadata: {
        source: 'admin',
        referenceId: originalTransaction._id.toString()
      },
      billing: {
        subtotal: refundAmount,
        total: refundAmount
      },
      timeline: {
        createdAt: new Date(),
        completedAt: new Date()
      },
      notes: [{
        adminId: admin._id,
        adminName: admin.name,
        note: `Refund processed: ${reason}`,
        timestamp: new Date()
      }]
    });

    await refundTransaction.save();

    // Update original transaction with refund information
    originalTransaction.refund = {
      refundId: refundTransaction._id.toString(),
      refundAmount,
      refundReason: reason,
      refundedAt: new Date(),
      refundedBy: {
        adminId: admin._id,
        name: admin.name
      }
    };

    await originalTransaction.save();

    res.json({
      success: true,
      data: {
        originalTransaction,
        refundTransaction
      },
      message: 'Refund processed successfully'
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund'
    });
  }
};

// Get available features for plan creation/editing
export const getAvailableFeatures = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    res.json({
      success: true,
      data: {
        features: AVAILABLE_FEATURES,
        categories: FEATURE_CATEGORIES
      }
    });
  } catch (error) {
    console.error('Error getting available features:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available features'
    });
  }
};
