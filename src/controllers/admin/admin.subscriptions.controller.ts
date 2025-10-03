import { Request, Response } from 'express';
import Subscription from '../../models/Subscription';
import SubscriptionPlan from '../../models/SubscriptionPlan';
import Transaction from '../../models/Transaction';
import { AuthenticatedRequest } from '../../middleware/admin.auth.middleware';

// Subscription Management Controllers

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

    // Build filter
    const filter: any = {};
    if (status) filter.status = status;
    if (planId) filter.planId = planId;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build aggregation pipeline for search
    let pipeline: any[] = [
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $lookup: { from: 'subscriptionplans', localField: 'planId', foreignField: '_id', as: 'plan' } },
      { $unwind: '$user' },
      { $unwind: '$plan' }
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'user.name': { $regex: search, $options: 'i' } },
            { 'user.email': { $regex: search, $options: 'i' } },
            { 'plan.name': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Add other filters
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    // Add sorting, skip, and limit
    pipeline.push(
      { $sort: sort },
      { $skip: skip },
      { $limit: limitNum }
    );

    // Execute aggregation
    const subscriptions = await Subscription.aggregate(pipeline);

    // Get total count for pagination
    const totalPipeline = [...pipeline.slice(0, -3)]; // Remove sort, skip, limit
    totalPipeline.push({ $count: 'total' });
    const totalResult = await Subscription.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    res.json({
      success: true,
      data: subscriptions,
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

    // Add admin note if reason provided
    if (updateData.reason) {
      const note = {
        adminId: admin._id,
        adminName: admin.name,
        note: `Subscription updated: ${updateData.reason}`,
        timestamp: new Date()
      };

      updateData.$push = { notes: note };
      delete updateData.reason;
    }

    const subscription = await Subscription.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
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

    // Add subscription counts to plans
    const plansWithCounts = plans.map(plan => {
      const countData = subscriptionCounts.find(sc => sc._id.toString() === plan._id.toString());
      return {
        ...plan,
        activeSubscriptions: countData?.count || 0
      };
    });

    res.json({
      success: true,
      data: plansWithCounts
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
    const planData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Set admin information
    planData.createdBy = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
    };

    planData.lastModifiedBy = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
    };

    const plan = new SubscriptionPlan(planData);
    await plan.save();

    res.status(201).json({
      success: true,
      data: plan,
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

export const updatePlan = async (req: AuthenticatedRequest, res: Response) => {
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

    updateData.lastModifiedBy = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
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

    res.json({
      success: true,
      data: plan,
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

export const getBillingOverview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate) dateFilter.$lte = new Date(endDate as string);

    // Get subscription statistics
    const [
      totalSubscriptions,
      activeSubscriptions,
      cancelledSubscriptions,
      trialSubscriptions,
      totalRevenue,
      monthlyRevenue,
      yearlyRevenue
    ] = await Promise.all([
      Subscription.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ status: 'cancelled' }),
      Subscription.countDocuments({ status: 'trialing' }),
      Transaction.aggregate([
        { $match: { status: 'completed', type: 'payment' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { 
          $match: { 
            status: 'completed', 
            type: 'payment',
            createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { 
          $match: { 
            status: 'completed', 
            type: 'payment',
            createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    // Get revenue by plan
    const revenueByPlan = await Transaction.aggregate([
      { $match: { status: 'completed', type: 'payment' } },
      { $lookup: { from: 'subscriptions', localField: 'subscriptionId', foreignField: '_id', as: 'subscription' } },
      { $unwind: '$subscription' },
      { $lookup: { from: 'subscriptionplans', localField: 'subscription.planId', foreignField: '_id', as: 'plan' } },
      { $unwind: '$plan' },
      { $group: { _id: '$plan.name', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { revenue: -1 } }
    ]);

    // Get monthly revenue trend (last 12 months)
    const monthlyTrend = await Transaction.aggregate([
      { 
        $match: { 
          status: 'completed', 
          type: 'payment',
          createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 12)) }
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get recent transactions
    const recentTransactions = await Transaction.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name email')
      .lean();

    // Calculate churn rate (cancelled subscriptions in last 30 days / total active at start of period)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const cancelledLast30Days = await Subscription.countDocuments({
      status: 'cancelled',
      cancelledAt: { $gte: thirtyDaysAgo }
    });

    const churnRate = activeSubscriptions > 0 ? (cancelledLast30Days / activeSubscriptions) * 100 : 0;

    const overview = {
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        cancelled: cancelledSubscriptions,
        trialing: trialSubscriptions,
        churnRate: Math.round(churnRate * 100) / 100
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        monthly: monthlyRevenue[0]?.total || 0,
        yearly: yearlyRevenue[0]?.total || 0,
        byPlan: revenueByPlan,
        monthlyTrend
      },
      recentTransactions
    };

    res.json({
      success: true,
      data: overview
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
