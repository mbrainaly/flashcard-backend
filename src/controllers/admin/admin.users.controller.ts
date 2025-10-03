import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../../models/User';
import Deck from '../../models/Deck';
import Card from '../../models/Card';
import Quiz from '../../models/Quiz';
import Note from '../../models/note.model';
import Subscription from '../../models/Subscription';
import Transaction from '../../models/Transaction';
import { AuthenticatedRequest } from '../../middleware/admin.auth.middleware';

// User Management Controllers

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, role = 'basic', isActive = true } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Map frontend role to subscription plan (role is now the actual plan name)
    const subscriptionPlan = role;

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      provider: 'local',
      isActive,
      subscription: {
        plan: subscriptionPlan,
        status: 'active',
        credits: subscriptionPlan === 'pro' ? 200 : subscriptionPlan === 'team' ? 500 : 50
      }
    });

    await user.save();

    // Return user without password
    const userResponse = await User.findById(user._id)
      .select('-password')
      .lean();

    // Format response to match frontend expectations
    const formattedUser = {
      ...userResponse,
      role: role,
      stats: {
        totalDecks: 0,
        totalCards: 0,
        studySessions: 0
      }
    };

    res.status(201).json({
      success: true,
      data: formattedUser,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      search, 
      provider, 
      subscriptionPlan,
      subscriptionStatus,
      dateFrom, 
      dateTo,
      isActive,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter: any = {};
    
    if (provider) filter.provider = provider;
    if (subscriptionPlan) filter['subscription.plan'] = subscriptionPlan;
    if (subscriptionStatus) filter['subscription.status'] = subscriptionStatus;
    if (isActive !== undefined) {
      // Consider user active if they logged in within last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (isActive === 'true') {
        filter.lastLogin = { $gte: thirtyDaysAgo };
      } else {
        filter.$or = [
          { lastLogin: { $lt: thirtyDaysAgo } },
          { lastLogin: { $exists: false } }
        ];
      }
    }
    
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get users with aggregation to include additional data
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'decks',
          localField: '_id',
          foreignField: 'owner',
          as: 'decks'
        }
      },
      {
        $lookup: {
          from: 'subscriptions',
          localField: '_id',
          foreignField: 'userId',
          as: 'subscriptions'
        }
      },
      {
        $addFields: {
          deckCount: { $size: '$decks' },
          totalCards: {
            $sum: '$decks.totalCards'
          },
          activeSubscription: {
            $arrayElemAt: [
              { $filter: { input: '$subscriptions', cond: { $eq: ['$$this.status', 'active'] } } },
              0
            ]
          }
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          provider: 1,
          image: 1,
          isActive: { $ifNull: ['$isActive', true] }, // Default to true if undefined
          lastLogin: 1,
          subscription: 1,
          createdAt: 1,
          updatedAt: 1,
          deckCount: 1,
          totalCards: 1,
          activeSubscription: 1,
          // Map subscription.plan to role for frontend compatibility
          role: {
            $switch: {
              branches: [
                { case: { $eq: ['$subscription.plan', 'pro'] }, then: 'pro' },
                { case: { $eq: ['$subscription.plan', 'team'] }, then: 'team' },
                { case: { $eq: ['$subscription.plan', 'basic'] }, then: 'basic' }
              ],
              default: 'basic'
            }
          },
          // Format stats for frontend
          stats: {
            totalDecks: '$deckCount',
            totalCards: '$totalCards',
            studySessions: { $ifNull: ['$studySessions', 0] }
          }
        }
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: limitNum }
    ];

    const [users, totalResult] = await Promise.all([
      User.aggregate(pipeline),
      User.aggregate([
        { $match: filter },
        { $count: 'total' }
      ])
    ]);

    const total = totalResult[0]?.total || 0;

    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

export const getUserById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password') // Exclude password
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's content statistics
    const [
      deckCount,
      cardCount,
      quizCount,
      noteCount,
      recentDecks,
      activeSubscription,
      transactionHistory
    ] = await Promise.all([
      Deck.countDocuments({ owner: id }),
      Card.countDocuments({ createdBy: id }),
      Quiz.countDocuments({ owner: id }),
      Note.countDocuments({ userId: id }),
      Deck.find({ owner: id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title totalCards createdAt')
        .lean(),
      Subscription.findOne({ userId: id, status: 'active' })
        .populate('planId', 'name price features')
        .lean(),
      Transaction.find({ userId: id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('type amount currency status createdAt description')
        .lean()
    ]);

    // Calculate additional stats for frontend compatibility
    const quizStats = await Quiz.aggregate([
      { $match: { owner: user._id } },
      { $unwind: '$attempts' },
      { $match: { 'attempts.userId': user._id } },
      {
        $group: {
          _id: null,
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$attempts.score' },
          totalTimeSpent: { $sum: '$attempts.timeSpent' }
        }
      }
    ]);

    const studyStats = quizStats[0] || { totalAttempts: 0, averageScore: 0, totalTimeSpent: 0 };

    // Get recent activity for frontend
    const recentActivity = await Promise.all([
      // Recent deck creation
      Deck.find({ owner: user._id })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('title createdAt')
        .lean()
        .then(decks => decks.map(deck => ({
          id: deck._id.toString(),
          type: 'create',
          description: `Created deck "${deck.title}"`,
          timestamp: deck.createdAt
        }))),
      
      // Recent quiz attempts
      Quiz.find({ owner: user._id, 'attempts.userId': user._id })
        .sort({ 'attempts.completedAt': -1 })
        .limit(2)
        .select('title attempts')
        .lean()
        .then(quizzes => {
          const attempts = [];
          quizzes.forEach(quiz => {
            const userAttempts = quiz.attempts
              .filter(attempt => attempt.userId.toString() === user._id.toString())
              .slice(0, 1);
            userAttempts.forEach(attempt => {
              attempts.push({
                id: `${quiz._id}-${attempt._id}`,
                type: 'study',
                description: `Completed study session for "${quiz.title}"`,
                timestamp: attempt.completedAt
              });
            });
          });
          return attempts;
        })
    ]);

    const allRecentActivity = [...recentActivity[0], ...recentActivity[1]]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    // Format user data to match frontend expectations
    const formattedUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.subscription?.plan === 'pro' || user.subscription?.plan === 'team' ? 'premium' : 'user',
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      subscription: activeSubscription ? {
        plan: activeSubscription.planId?.name || user.subscription?.plan || 'Basic',
        status: activeSubscription.status,
        expiresAt: activeSubscription.billing?.nextBillingDate,
        startedAt: activeSubscription.createdAt
      } : undefined,
      stats: {
        totalDecks: deckCount,
        totalCards: cardCount,
        studySessions: studyStats.totalAttempts,
        totalStudyTime: Math.round(studyStats.totalTimeSpent / 60) || 0, // Convert seconds to minutes
        averageScore: Math.round(studyStats.averageScore) || 0,
        streak: 0 // TODO: Implement streak calculation
      },
      recentActivity: allRecentActivity
    };

    res.json({
      success: true,
      data: formattedUser
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Handle role to subscription plan mapping
    if (updateData.role) {
      const subscriptionPlan = updateData.role; // Role is now the actual plan name
      
      // If subscription object exists in the update data, update the plan within it
      if (updateData.subscription) {
        updateData.subscription = {
          ...updateData.subscription,
          plan: subscriptionPlan,
          // Update credits based on plan
          credits: subscriptionPlan === 'pro' ? 200 : subscriptionPlan === 'team' ? 500 : 50
        };
      } else {
        // If no subscription object, use dot notation to update nested field
        updateData['subscription.plan'] = subscriptionPlan;
        updateData['subscription.credits'] = subscriptionPlan === 'pro' ? 200 : subscriptionPlan === 'team' ? 500 : 50;
      }
      
      delete updateData.role; // Remove role from updateData as it's not a direct field
    }

    // Handle password update if provided
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    // Remove sensitive fields that shouldn't be updated via admin
    delete updateData.provider;
    delete updateData.providerId;

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Format response to match frontend expectations
    const formattedUser = {
      ...user,
      role: user.subscription?.plan || 'basic', // Return the actual plan name as role
      stats: {
        totalDecks: 0, // Will be calculated in real implementation
        totalCards: 0,
        studySessions: 0
      }
    };

    res.json({
      success: true,
      data: formattedUser,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { deleteContent = false } = req.body;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (deleteContent) {
      // Delete all user content
      await Promise.all([
        Deck.deleteMany({ owner: id }),
        Card.deleteMany({ createdBy: id }),
        Quiz.deleteMany({ owner: id }),
        Note.deleteMany({ userId: id })
      ]);
    } else {
      // Check if user has content
      const [deckCount, cardCount, quizCount, noteCount] = await Promise.all([
        Deck.countDocuments({ owner: id }),
        Card.countDocuments({ createdBy: id }),
        Quiz.countDocuments({ owner: id }),
        Note.countDocuments({ userId: id })
      ]);

      const totalContent = deckCount + cardCount + quizCount + noteCount;
      if (totalContent > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete user. User has ${totalContent} pieces of content. Set deleteContent=true to delete all content.`,
          contentCount: {
            decks: deckCount,
            cards: cardCount,
            quizzes: quizCount,
            notes: noteCount
          }
        });
      }
    }

    // Cancel active subscriptions
    await Subscription.updateMany(
      { userId: id, status: 'active' },
      { 
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: 'User account deleted by admin'
      }
    );

    // Delete the user
    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

export const getUserActivity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, type, search, dateFrom, dateTo } = req.query;

    // Check if user exists
    const user = await User.findById(id).select('name email');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build date filter
    const dateFilter: any = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom as string);
    if (dateTo) dateFilter.$lte = new Date(dateTo as string);

    // Get user activity from different sources
    const activities: any[] = [];

    // Deck creation activities
    if (!type || type === 'create') {
      const deckFilter: any = { owner: id };
      if (Object.keys(dateFilter).length > 0) deckFilter.createdAt = dateFilter;

      const decks = await Deck.find(deckFilter)
        .sort({ createdAt: -1 })
        .limit(50)
        .select('title createdAt totalCards')
        .lean();

      decks.forEach(deck => {
        activities.push({
          id: `deck-create-${deck._id}`,
          type: 'create',
          title: 'Deck Created',
          description: `Created new deck "${deck.title}"`,
          timestamp: deck.createdAt,
          metadata: {
            deckName: deck.title,
            cardCount: deck.totalCards || 0
          }
        });
      });
    }

    // Study session activities (from quiz attempts)
    if (!type || type === 'study') {
      const quizFilter: any = { owner: id };
      if (Object.keys(dateFilter).length > 0) quizFilter.createdAt = dateFilter;

      const quizzes = await Quiz.find(quizFilter)
        .sort({ createdAt: -1 })
        .limit(50)
        .select('title attempts')
        .lean();

      quizzes.forEach(quiz => {
        quiz.attempts
          .filter(attempt => attempt.userId.toString() === id)
          .slice(0, 10)
          .forEach(attempt => {
            activities.push({
              id: `study-${quiz._id}-${attempt._id}`,
              type: 'study',
              title: 'Study Session Completed',
              description: `Completed study session for "${quiz.title}"`,
              timestamp: attempt.completedAt,
              metadata: {
                deckName: quiz.title,
                score: attempt.score,
                duration: Math.round(attempt.timeSpent / 60) // Convert to minutes
              }
            });
          });
      });
    }

    // Login activities (simulated - in real app you'd track these)
    if (!type || type === 'login') {
      if (user.lastLogin) {
        activities.push({
          id: `login-${user._id}`,
          type: 'login',
          title: 'User Login',
          description: 'Logged in to the platform',
          timestamp: user.lastLogin,
          ipAddress: '192.168.1.100', // In real app, you'd store this
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        });
      }
    }

    // Subscription activities
    if (!type || type === 'subscription') {
      const subscriptions = await Subscription.find({ userId: id })
        .sort({ createdAt: -1 })
        .populate('planId', 'name')
        .lean();

      subscriptions.forEach(subscription => {
        activities.push({
          id: `subscription-${subscription._id}`,
          type: 'subscription',
          title: 'Subscription Updated',
          description: `Subscribed to ${subscription.planId?.name || 'Premium'} plan`,
          timestamp: subscription.createdAt,
          metadata: {
            subscriptionPlan: subscription.planId?.name || 'Premium'
          }
        });

        if (subscription.cancelledAt) {
          activities.push({
            id: `subscription-cancel-${subscription._id}`,
            type: 'subscription',
            title: 'Subscription Cancelled',
            description: `Cancelled ${subscription.planId?.name || 'Premium'} subscription`,
            timestamp: subscription.cancelledAt,
            metadata: {
              subscriptionPlan: subscription.planId?.name || 'Premium'
            }
          });
        }
      });
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply search filter
    let filteredActivities = activities;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredActivities = activities.filter(activity =>
        activity.title.toLowerCase().includes(searchTerm) ||
        activity.description.toLowerCase().includes(searchTerm) ||
        activity.metadata?.deckName?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply pagination
    const paginatedActivities = filteredActivities.slice(skip, skip + limitNum);
    const total = filteredActivities.length;

    res.json({
      success: true,
      data: paginatedActivities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity'
    });
  }
};

export const getUserSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id).select('name email subscription');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get current subscription
    const currentSubscription = await Subscription.findOne({ userId: id, status: 'active' })
      .populate('planId', 'name description price features')
      .lean();

    // Get subscription history
    const subscriptionHistory = await Subscription.find({ userId: id })
      .sort({ createdAt: -1 })
      .populate('planId', 'name price')
      .select('status createdAt cancelledAt billing planId')
      .lean();

    // Get recent transactions
    const recentTransactions = await Transaction.find({ 
      userId: id, 
      subscriptionId: currentSubscription?._id 
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('type amount currency status createdAt')
      .lean();

    // Calculate subscription metrics
    const metrics = {
      totalSubscriptions: subscriptionHistory.length,
      totalRevenue: recentTransactions
        .filter(t => t.type === 'payment' && t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0),
      subscriptionDuration: currentSubscription 
        ? Math.floor((Date.now() - new Date(currentSubscription.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0
    };

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          subscription: user.subscription
        },
        currentSubscription,
        subscriptionHistory,
        recentTransactions,
        metrics
      }
    });
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user subscription'
    });
  }
};

export const updateUserSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, planId, reason } = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let result: any = {};

    switch (action) {
      case 'cancel':
        const activeSubscription = await Subscription.findOne({ userId: id, status: 'active' });
        if (!activeSubscription) {
          return res.status(404).json({
            success: false,
            message: 'No active subscription found'
          });
        }

        await Subscription.findByIdAndUpdate(activeSubscription._id, {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: reason || 'Cancelled by admin',
          $push: {
            notes: {
              adminId: admin._id,
              adminName: admin.name,
              note: `Subscription cancelled by admin: ${reason || 'No reason provided'}`,
              timestamp: new Date()
            }
          }
        });

        result = { action: 'cancelled', subscriptionId: activeSubscription._id };
        break;

      case 'reactivate':
        const cancelledSubscription = await Subscription.findOne({ 
          userId: id, 
          status: 'cancelled' 
        }).sort({ createdAt: -1 });

        if (!cancelledSubscription) {
          return res.status(404).json({
            success: false,
            message: 'No cancelled subscription found to reactivate'
          });
        }

        await Subscription.findByIdAndUpdate(cancelledSubscription._id, {
          status: 'active',
          cancelledAt: null,
          cancelReason: null,
          $push: {
            notes: {
              adminId: admin._id,
              adminName: admin.name,
              note: `Subscription reactivated by admin: ${reason || 'No reason provided'}`,
              timestamp: new Date()
            }
          }
        });

        result = { action: 'reactivated', subscriptionId: cancelledSubscription._id };
        break;

      case 'change_plan':
        if (!planId) {
          return res.status(400).json({
            success: false,
            message: 'Plan ID is required for plan change'
          });
        }

        const currentSubscription = await Subscription.findOne({ userId: id, status: 'active' });
        if (!currentSubscription) {
          return res.status(404).json({
            success: false,
            message: 'No active subscription found'
          });
        }

        await Subscription.findByIdAndUpdate(currentSubscription._id, {
          planId: planId,
          $push: {
            notes: {
              adminId: admin._id,
              adminName: admin.name,
              note: `Plan changed by admin: ${reason || 'No reason provided'}`,
              timestamp: new Date()
            }
          }
        });

        result = { action: 'plan_changed', subscriptionId: currentSubscription._id, newPlanId: planId };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Supported actions: cancel, reactivate, change_plan'
        });
    }

    res.json({
      success: true,
      data: result,
      message: `Subscription ${action} completed successfully`
    });
  } catch (error) {
    console.error('Error updating user subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user subscription'
    });
  }
};

export const getUserStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { period = '30d' } = req.query;

    // Check if user exists
    const user = await User.findById(id).select('name email createdAt');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = user.createdAt;
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get comprehensive user statistics
    const [
      totalDecks,
      totalCards,
      totalQuizzes,
      totalNotes,
      periodDecks,
      periodCards,
      periodQuizzes,
      cardsByStatus,
      quizAttempts,
      studySessionsData
    ] = await Promise.all([
      Deck.countDocuments({ owner: id }),
      Card.countDocuments({ createdBy: id }),
      Quiz.countDocuments({ owner: id }),
      Note.countDocuments({ userId: id }),
      Deck.countDocuments({ owner: id, createdAt: { $gte: startDate } }),
      Card.countDocuments({ createdBy: id, createdAt: { $gte: startDate } }),
      Quiz.countDocuments({ owner: id, createdAt: { $gte: startDate } }),
      Card.aggregate([
        { $match: { createdBy: id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Quiz.aggregate([
        { $match: { owner: id } },
        { $unwind: '$attempts' },
        { $match: { 'attempts.userId': id } },
        {
          $group: {
            _id: null,
            totalAttempts: { $sum: 1 },
            averageScore: { $avg: '$attempts.score' },
            totalTimeSpent: { $sum: '$attempts.timeSpent' }
          }
        }
      ]),
      Deck.aggregate([
        { $match: { owner: id } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastStudied' } },
            sessionsCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Calculate learning progress
    const cardStatusDistribution = cardsByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { new: 0, learning: 0, mastered: 0 });

    const learningProgress = {
      totalCards,
      masteryRate: totalCards > 0 ? (cardStatusDistribution.mastered / totalCards) * 100 : 0,
      inProgress: cardStatusDistribution.learning,
      newCards: cardStatusDistribution.new,
      masteredCards: cardStatusDistribution.mastered
    };

    // Quiz performance
    const quizPerformance = quizAttempts[0] || {
      totalAttempts: 0,
      averageScore: 0,
      totalTimeSpent: 0
    };

    // Activity trends
    const activityTrends = {
      decksCreated: periodDecks,
      cardsCreated: periodCards,
      quizzesCreated: periodQuizzes,
      studySessions: studySessionsData.length
    };

    const stats = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        memberSince: user.createdAt
      },
      overview: {
        totalDecks,
        totalCards,
        totalQuizzes,
        totalNotes,
        totalContent: totalDecks + totalCards + totalQuizzes + totalNotes
      },
      learningProgress,
      quizPerformance: {
        ...quizPerformance,
        averageTimePerAttempt: quizPerformance.totalAttempts > 0 
          ? quizPerformance.totalTimeSpent / quizPerformance.totalAttempts 
          : 0
      },
      activityTrends,
      studySessions: studySessionsData,
      period: period as string
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
};
