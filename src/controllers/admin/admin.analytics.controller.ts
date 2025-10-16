import { Request, Response } from 'express';
import User from '../../models/User';
import Deck from '../../models/Deck';
import Card from '../../models/Card';
import Quiz from '../../models/Quiz';
import Note from '../../models/note.model';
import Subscription from '../../models/Subscription';
import SubscriptionPlan from '../../models/SubscriptionPlan';
import Transaction from '../../models/Transaction';
import Blog from '../../models/Blog';
import BlogCategory from '../../models/BlogCategory';
import BlogTag from '../../models/BlogTag';

// Dashboard Analytics Controller
// Recent Activity Controller
export const getRecentActivity = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = parseInt(limit as string);
    
    const activities: any[] = [];
    
    // Recent user registrations
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email createdAt')
      .lean();
    
    recentUsers.forEach(user => {
      activities.push({
        id: `user-${user._id}`,
        type: 'user',
        message: `New user registration: ${user.email}`,
        timestamp: user.createdAt,
        user: 'System'
      });
    });
    
    // Recent deck creations
    const recentDecks = await Deck.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('owner', 'name')
      .select('title createdAt owner')
      .lean();
    
    recentDecks.forEach(deck => {
      activities.push({
        id: `deck-${deck._id}`,
        type: 'content',
        message: `New deck created: "${deck.title}"`,
        timestamp: deck.createdAt,
        user: (deck.owner as any)?.name || 'Unknown User'
      });
    });
    
    // Recent subscriptions
    const recentSubscriptions = await Subscription.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('userId', 'name')
      .populate('planId', 'name')
      .select('createdAt userId planId')
      .lean();
    
    recentSubscriptions.forEach(sub => {
      activities.push({
        id: `subscription-${sub._id}`,
        type: 'subscription',
        message: `Premium subscription activated`,
        timestamp: sub.createdAt,
        user: (sub.userId as any)?.name || 'Unknown User'
      });
    });
    
    // Recent quiz completions
    const recentQuizzes = await Quiz.find({ 'attempts.0': { $exists: true } })
      .sort({ updatedAt: -1 })
      .limit(3)
      .populate('owner', 'name')
      .select('title updatedAt owner attempts')
      .lean();
    
    recentQuizzes.forEach(quiz => {
      const latestAttempt = quiz.attempts[quiz.attempts.length - 1];
      if (latestAttempt) {
        activities.push({
          id: `quiz-${quiz._id}`,
          type: 'content',
          message: `Quiz completed: "${quiz.title}"`,
          timestamp: latestAttempt.completedAt || quiz.updatedAt,
          user: (quiz.owner as any)?.name || 'Unknown User'
        });
      }
    });
    
    // Sort by timestamp and limit
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limitNum)
      .map(activity => ({
        ...activity,
        timestamp: formatTimeAgo(activity.timestamp)
      }));
    
    res.json({
      success: true,
      data: sortedActivities
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity'
    });
  }
};

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - new Date(date).getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  
  return new Date(date).toLocaleDateString();
}

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { period = '30d' } = req.query;

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
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get basic counts
    const [
      totalUsers,
      activeUsers,
      newUsers,
      totalDecks,
      totalCards,
      totalQuizzes,
      totalNotes,
      totalBlogs,
      activeSubscriptions,
      totalRevenue,
      periodRevenue
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastLogin: { $gte: startDate } }),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      Deck.countDocuments(),
      Card.countDocuments(),
      Quiz.countDocuments(),
      Note.countDocuments(),
      Blog.countDocuments({ status: 'published' }),
      Subscription.countDocuments({ status: 'active' }),
      Transaction.aggregate([
        { $match: { status: 'completed', type: 'payment' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { 
          $match: { 
            status: 'completed', 
            type: 'payment',
            createdAt: { $gte: startDate }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    // Calculate growth rates
    const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    
    const [
      previousUsers,
      previousRevenue,
      previousSubscriptions
    ] = await Promise.all([
      User.countDocuments({ 
        createdAt: { 
          $gte: previousPeriodStart, 
          $lt: startDate 
        } 
      }),
      Transaction.aggregate([
        { 
          $match: { 
            status: 'completed', 
            type: 'payment',
            createdAt: { 
              $gte: previousPeriodStart, 
              $lt: startDate 
            }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Subscription.countDocuments({ 
        createdAt: { 
          $gte: previousPeriodStart, 
          $lt: startDate 
        } 
      })
    ]);

    // Calculate growth percentages
    const userGrowth = previousUsers > 0 ? ((newUsers - previousUsers) / previousUsers) * 100 : 0;
    const revenueGrowth = (previousRevenue[0]?.total || 0) > 0 
      ? (((periodRevenue[0]?.total || 0) - (previousRevenue[0]?.total || 0)) / (previousRevenue[0]?.total || 0)) * 100 
      : 0;

    // Get daily activity for the period
    const dailyActivity = await User.aggregate([
      { $match: { lastLogin: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastLogin' } },
          activeUsers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get top performing content
    const topDecks = await Deck.find()
      .sort({ totalCards: -1 })
      .limit(5)
      .populate('owner', 'name email')
      .select('title totalCards owner createdAt')
      .lean();

    const stats = {
      overview: {
        totalUsers,
        activeUsers,
        newUsers,
        userGrowth: Math.round(userGrowth * 100) / 100,
        totalContent: totalDecks + totalCards + totalQuizzes + totalNotes,
        totalRevenue: totalRevenue[0]?.total || 0,
        periodRevenue: periodRevenue[0]?.total || 0,
        revenueGrowth: Math.round(revenueGrowth * 100) / 100,
        activeSubscriptions
      },
      content: {
        totalDecks,
        totalCards,
        totalQuizzes,
        totalNotes,
        totalBlogs,
        averageCardsPerDeck: totalDecks > 0 ? Math.round(totalCards / totalDecks) : 0
      },
      activity: {
        dailyActivity,
        period: period as string
      },
      topContent: {
        decks: topDecks
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

// User Analytics Controller
export const getUserAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, segment } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate) dateFilter.$lte = new Date(endDate as string);

    // User registration trends
    const registrationTrends = await User.aggregate([
      ...(Object.keys(dateFilter).length > 0 ? [{ $match: { createdAt: dateFilter } }] : []),
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // User engagement metrics
    const engagementMetrics = await User.aggregate([
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
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          createdAt: 1,
          lastLogin: 1,
          deckCount: { $size: '$decks' },
          hasActiveSubscription: {
            $gt: [
              { $size: { $filter: { input: '$subscriptions', cond: { $eq: ['$$this.status', 'active'] } } } },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: {
              $cond: [
                { $gte: ['$lastLogin', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          },
          contentCreators: {
            $sum: { $cond: [{ $gt: ['$deckCount', 0] }, 1, 0] }
          },
          subscribers: {
            $sum: { $cond: ['$hasActiveSubscription', 1, 0] }
          },
          averageDecksPerUser: { $avg: '$deckCount' }
        }
      }
    ]);

    // User retention analysis
    const retentionAnalysis = await User.aggregate([
      {
        $project: {
          createdAt: 1,
          lastLogin: 1,
          daysSinceRegistration: {
            $divide: [
              { $subtract: [new Date(), '$createdAt'] },
              1000 * 60 * 60 * 24
            ]
          },
          daysSinceLastLogin: {
            $divide: [
              { $subtract: [new Date(), '$lastLogin'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          day1Retention: {
            $avg: {
              $cond: [
                { $and: [{ $gte: ['$daysSinceRegistration', 1] }, { $lte: ['$daysSinceLastLogin', 1] }] },
                1,
                0
              ]
            }
          },
          day7Retention: {
            $avg: {
              $cond: [
                { $and: [{ $gte: ['$daysSinceRegistration', 7] }, { $lte: ['$daysSinceLastLogin', 7] }] },
                1,
                0
              ]
            }
          },
          day30Retention: {
            $avg: {
              $cond: [
                { $and: [{ $gte: ['$daysSinceRegistration', 30] }, { $lte: ['$daysSinceLastLogin', 30] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Geographic distribution (mock data - would need IP geolocation in real app)
    const geographicDistribution = [
      { country: 'United States', users: Math.floor(Math.random() * 1000) + 500 },
      { country: 'United Kingdom', users: Math.floor(Math.random() * 500) + 200 },
      { country: 'Canada', users: Math.floor(Math.random() * 300) + 150 },
      { country: 'Germany', users: Math.floor(Math.random() * 400) + 100 },
      { country: 'France', users: Math.floor(Math.random() * 300) + 80 }
    ];

    const analytics = {
      registrationTrends,
      engagement: engagementMetrics[0] || {
        totalUsers: 0,
        activeUsers: 0,
        contentCreators: 0,
        subscribers: 0,
        averageDecksPerUser: 0
      },
      retention: retentionAnalysis[0] || {
        day1Retention: 0,
        day7Retention: 0,
        day30Retention: 0
      },
      geographic: geographicDistribution
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user analytics'
    });
  }
};

// Content Analytics Controller
export const getContentAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, contentType } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate) dateFilter.$lte = new Date(endDate as string);

    // Content creation trends
    const contentTrends = await Promise.all([
      Deck.aggregate([
        ...(Object.keys(dateFilter).length > 0 ? [{ $match: { createdAt: dateFilter } }] : []),
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Card.aggregate([
        ...(Object.keys(dateFilter).length > 0 ? [{ $match: { createdAt: dateFilter } }] : []),
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Quiz.aggregate([
        ...(Object.keys(dateFilter).length > 0 ? [{ $match: { createdAt: dateFilter } }] : []),
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Most popular content
    const popularContent = await Deck.find()
      .sort({ totalCards: -1 })
      .limit(10)
      .populate('owner', 'name email')
      .select('title totalCards isPublic tags createdAt')
      .lean();

    // Content engagement metrics
    const engagementMetrics = await Quiz.aggregate([
      {
        $project: {
          title: 1,
          totalAttempts: { $size: '$attempts' },
          averageScore: {
            $cond: {
              if: { $gt: [{ $size: '$attempts' }, 0] },
              then: { $avg: '$attempts.score' },
              else: 0
            }
          },
          completionRate: {
            $cond: {
              if: { $gt: [{ $size: '$attempts' }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $size: { $filter: { input: '$attempts', cond: { $gte: ['$$this.score', 70] } } } },
                      { $size: '$attempts' }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          }
        }
      },
      { $sort: { totalAttempts: -1 } },
      { $limit: 10 }
    ]);

    // Tag popularity
    const tagPopularity = await Deck.aggregate([
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 },
          totalCards: { $sum: '$totalCards' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Content quality metrics
    const qualityMetrics = await Card.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const analytics = {
      trends: {
        decks: contentTrends[0],
        cards: contentTrends[1],
        quizzes: contentTrends[2]
      },
      popular: {
        decks: popularContent,
        quizzes: engagementMetrics
      },
      tags: tagPopularity,
      quality: qualityMetrics.reduce((acc, metric) => {
        acc[metric._id] = metric.count;
        return acc;
      }, { new: 0, learning: 0, mastered: 0 })
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching content analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch content analytics'
    });
  }
};

// Revenue Analytics Controller
export const getRevenueAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, currency = 'USD' } = req.query;

    // Build date filter
    const dateFilter: any = { status: 'completed', type: 'payment' };
    if (startDate) dateFilter.createdAt = { $gte: new Date(startDate as string) };
    if (endDate) {
      if (dateFilter.createdAt) {
        dateFilter.createdAt.$lte = new Date(endDate as string);
      } else {
        dateFilter.createdAt = { $lte: new Date(endDate as string) };
      }
    }

    // Revenue trends
    const revenueTrends = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Revenue by subscription plan
    const revenueByPlan = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: 'subscriptions',
          localField: 'subscriptionId',
          foreignField: '_id',
          as: 'subscription'
        }
      },
      { $unwind: '$subscription' },
      {
        $lookup: {
          from: 'subscriptionplans',
          localField: 'subscription.planId',
          foreignField: '_id',
          as: 'plan'
        }
      },
      { $unwind: '$plan' },
      {
        $group: {
          _id: '$plan.name',
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
          subscribers: { $addToSet: '$subscription.userId' }
        }
      },
      {
        $project: {
          _id: 1,
          revenue: 1,
          transactions: 1,
          uniqueSubscribers: { $size: '$subscribers' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Monthly recurring revenue (MRR)
    const mrrData = await Subscription.aggregate([
      { $match: { status: 'active' } },
      {
        $lookup: {
          from: 'subscriptionplans',
          localField: 'planId',
          foreignField: '_id',
          as: 'plan'
        }
      },
      { $unwind: '$plan' },
      {
        $group: {
          _id: null,
          totalMRR: {
            $sum: {
              $cond: {
                if: { $eq: ['$billing.interval', 'month'] },
                then: '$billing.amount',
                else: { $divide: ['$billing.amount', 12] } // Convert yearly to monthly
              }
            }
          },
          activeSubscriptions: { $sum: 1 }
        }
      }
    ]);

    // Refund analysis
    const refundAnalysis = await Transaction.aggregate([
      { $match: { type: 'refund', status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: { $abs: '$amount' } },
          refundCount: { $sum: 1 }
        }
      }
    ]);

    // Customer lifetime value (CLV) estimation
    const clvData = await Subscription.aggregate([
      { $match: { status: { $in: ['active', 'cancelled'] } } },
      {
        $group: {
          _id: '$userId',
          totalRevenue: { $sum: '$billing.amount' },
          subscriptionDuration: {
            $avg: {
              $divide: [
                { $subtract: ['$currentPeriodEnd', '$currentPeriodStart'] },
                1000 * 60 * 60 * 24 * 30 // Convert to months
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          averageCLV: { $avg: '$totalRevenue' },
          averageSubscriptionDuration: { $avg: '$subscriptionDuration' }
        }
      }
    ]);

    const analytics = {
      trends: revenueTrends,
      byPlan: revenueByPlan,
      mrr: mrrData[0] || { totalMRR: 0, activeSubscriptions: 0 },
      refunds: refundAnalysis[0] || { totalRefunds: 0, refundCount: 0 },
      clv: clvData[0] || { averageCLV: 0, averageSubscriptionDuration: 0 },
      summary: {
        totalRevenue: revenueTrends.reduce((sum, day) => sum + day.revenue, 0),
        totalTransactions: revenueTrends.reduce((sum, day) => sum + day.transactions, 0),
        averageTransactionValue: revenueTrends.length > 0 
          ? revenueTrends.reduce((sum, day) => sum + day.revenue, 0) / revenueTrends.reduce((sum, day) => sum + day.transactions, 0)
          : 0
      }
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics'
    });
  }
};

// AI Usage Analytics Controller
export const getAIUsageAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Since we don't have a dedicated AI usage tracking model, 
    // we'll create mock data based on realistic usage patterns
    // In a real implementation, you'd track AI API calls, costs, etc.

    const mockAIUsage = {
      overview: {
        totalRequests: Math.floor(Math.random() * 10000) + 5000,
        totalCost: Math.floor(Math.random() * 1000) + 500,
        averageResponseTime: Math.floor(Math.random() * 2000) + 500, // ms
        successRate: 98.5 + Math.random() * 1.5 // 98.5-100%
      },
      byModel: [
        {
          model: 'Claude Sonnet 4',
          usage: 'Notes Generation, PDF Processing',
          requests: Math.floor(Math.random() * 3000) + 2000,
          cost: Math.floor(Math.random() * 400) + 200,
          averageTokens: Math.floor(Math.random() * 2000) + 1000
        },
        {
          model: 'Gemini 2.5 Flash',
          usage: 'Flashcard Generation',
          requests: Math.floor(Math.random() * 5000) + 3000,
          cost: Math.floor(Math.random() * 300) + 150,
          averageTokens: Math.floor(Math.random() * 1500) + 800
        }
      ],
      trends: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        requests: Math.floor(Math.random() * 500) + 100,
        cost: Math.floor(Math.random() * 50) + 10,
        errors: Math.floor(Math.random() * 10)
      })),
      topUsers: Array.from({ length: 10 }, (_, i) => ({
        userId: `user_${i + 1}`,
        name: `User ${i + 1}`,
        requests: Math.floor(Math.random() * 200) + 50,
        cost: Math.floor(Math.random() * 20) + 5
      })),
      errorAnalysis: {
        rateLimitErrors: Math.floor(Math.random() * 50) + 10,
        timeoutErrors: Math.floor(Math.random() * 30) + 5,
        authenticationErrors: Math.floor(Math.random() * 10) + 1,
        otherErrors: Math.floor(Math.random() * 20) + 3
      }
    };

    res.json({
      success: true,
      data: mockAIUsage
    });
  } catch (error) {
    console.error('Error fetching AI usage analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI usage analytics'
    });
  }
};

// System Performance Controller
export const getSystemPerformance = async (req: Request, res: Response) => {
  try {
    // Mock system performance data
    // In a real implementation, you'd integrate with monitoring tools like New Relic, DataDog, etc.
    
    const mockPerformance = {
      server: {
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        diskUsage: Math.random() * 100,
        uptime: Math.floor(Math.random() * 30) + 1, // days
        loadAverage: Math.random() * 5
      },
      database: {
        connectionPool: {
          active: Math.floor(Math.random() * 50) + 10,
          idle: Math.floor(Math.random() * 20) + 5,
          total: 100
        },
        queryPerformance: {
          averageResponseTime: Math.floor(Math.random() * 100) + 10, // ms
          slowQueries: Math.floor(Math.random() * 10),
          totalQueries: Math.floor(Math.random() * 10000) + 5000
        },
        storage: {
          totalSize: Math.floor(Math.random() * 1000) + 500, // GB
          usedSize: Math.floor(Math.random() * 500) + 200, // GB
          indexSize: Math.floor(Math.random() * 100) + 50 // GB
        }
      },
      api: {
        requestsPerMinute: Math.floor(Math.random() * 1000) + 500,
        averageResponseTime: Math.floor(Math.random() * 500) + 100, // ms
        errorRate: Math.random() * 5, // percentage
        endpoints: [
          { path: '/api/decks', requests: Math.floor(Math.random() * 1000) + 500, avgTime: Math.floor(Math.random() * 200) + 50 },
          { path: '/api/cards', requests: Math.floor(Math.random() * 800) + 400, avgTime: Math.floor(Math.random() * 150) + 40 },
          { path: '/api/auth', requests: Math.floor(Math.random() * 600) + 300, avgTime: Math.floor(Math.random() * 300) + 100 },
          { path: '/api/ai', requests: Math.floor(Math.random() * 400) + 200, avgTime: Math.floor(Math.random() * 2000) + 500 }
        ]
      },
      cache: {
        hitRate: 85 + Math.random() * 15, // 85-100%
        memoryUsage: Math.random() * 100,
        totalKeys: Math.floor(Math.random() * 10000) + 5000,
        evictions: Math.floor(Math.random() * 100) + 10
      },
      alerts: [
        {
          id: '1',
          type: 'warning',
          message: 'High memory usage detected',
          timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          resolved: Math.random() > 0.5
        },
        {
          id: '2',
          type: 'info',
          message: 'Database backup completed successfully',
          timestamp: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000),
          resolved: true
        }
      ]
    };

    res.json({
      success: true,
      data: mockPerformance
    });
  } catch (error) {
    console.error('Error fetching system performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system performance metrics'
    });
  }
};

// Export Analytics Controller
export const exportAnalytics = async (req: Request, res: Response) => {
  try {
    const { type, format = 'json', startDate, endDate } = req.body;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    let data: any = {};

    switch (type) {
      case 'users':
        data = await User.find(
          Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}
        )
          .select('name email createdAt lastLogin')
          .lean();
        break;

      case 'content':
        const [decks, cards, quizzes, notes] = await Promise.all([
          Deck.find(
            Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}
          ).populate('owner', 'name email').lean(),
          Card.find(
            Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}
          ).populate('deck', 'title').lean(),
          Quiz.find(
            Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}
          ).populate('owner', 'name email').lean(),
          Note.find(
            Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}
          ).populate('userId', 'name email').lean()
        ]);
        data = { decks, cards, quizzes, notes };
        break;

      case 'revenue':
        data = await Transaction.find({
          status: 'completed',
          type: 'payment',
          ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
        })
          .populate('userId', 'name email')
          .lean();
        break;

      case 'subscriptions':
        data = await Subscription.find(
          Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}
        )
          .populate('userId', 'name email')
          .populate('planId', 'name price')
          .lean();
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    // Format data based on requested format
    let exportData: string;
    let contentType: string;
    let filename: string;

    if (format === 'csv') {
      // Convert to CSV (simplified - would use a proper CSV library in production)
      const csvData = Array.isArray(data) ? data : [data];
      const headers = csvData.length > 0 ? Object.keys(csvData[0]).join(',') : '';
      const rows = csvData.map(row => Object.values(row).join(',')).join('\n');
      exportData = headers + '\n' + rows;
      contentType = 'text/csv';
      filename = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      exportData = JSON.stringify(data, null, 2);
      contentType = 'application/json';
      filename = `${type}_export_${new Date().toISOString().split('T')[0]}.json`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);

  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export analytics data'
    });
  }
};
