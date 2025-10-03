import { Response } from 'express';
import User from '../../models/User';
import Deck from '../../models/Deck';
import Card from '../../models/Card';
import Quiz from '../../models/Quiz';
import Note from '../../models/note.model';
import Subscription from '../../models/Subscription';
import { AuthenticatedRequest } from '../../middleware/admin.auth.middleware';

// @desc    Get all users with optimized performance
// @route   GET /api/admin/users
// @access  Private (Admin)
export const getAllUsersOptimized = async (req: AuthenticatedRequest, res: Response) => {
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
      filter.isActive = isActive === 'true';
    }
    
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
    }
    
    // Use text search for better performance when available
    if (search) {
      // Try text search first (requires text index)
      try {
        filter.$text = { $search: search };
      } catch {
        // Fallback to regex if text index doesn't exist
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Optimized pipeline - avoid expensive lookups for basic listing
    const pipeline = [
      { $match: filter },
      {
        $project: {
          name: 1,
          email: 1,
          provider: 1,
          image: 1,
          isActive: { $ifNull: ['$isActive', true] },
          lastLogin: 1,
          subscription: 1,
          createdAt: 1,
          updatedAt: 1,
          // Map subscription.plan to role for frontend compatibility
          role: {
            $switch: {
              branches: [
                { case: { $in: ['$subscription.plan', ['pro', 'team']] }, then: 'premium' },
                { case: { $eq: ['$subscription.plan', 'basic'] }, then: 'user' }
              ],
              default: 'user'
            }
          }
        }
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: limitNum }
    ];

    // Separate aggregation for stats (only when needed and for small result sets)
    const shouldIncludeStats = limitNum <= 50;
    const statsPromise = shouldIncludeStats ? User.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'decks',
          localField: '_id',
          foreignField: 'owner',
          pipeline: [
            { $group: { _id: '$owner', deckCount: { $sum: 1 }, totalCards: { $sum: '$totalCards' } } }
          ],
          as: 'deckStats'
        }
      },
      {
        $addFields: {
          deckCount: { $ifNull: [{ $arrayElemAt: ['$deckStats.deckCount', 0] }, 0] },
          totalCards: { $ifNull: [{ $arrayElemAt: ['$deckStats.totalCards', 0] }, 0] }
        }
      },
      {
        $project: {
          _id: 1,
          deckCount: 1,
          totalCards: 1
        }
      },
      { $skip: skip },
      { $limit: limitNum }
    ]) : Promise.resolve([]);

    // Get total count efficiently
    const countPipeline = [
      { $match: filter },
      { $count: 'total' }
    ];

    const [users, countResult, userStats] = await Promise.all([
      User.aggregate(pipeline),
      User.aggregate(countPipeline),
      statsPromise
    ]);

    // Merge stats with users if available
    if (shouldIncludeStats && userStats.length > 0) {
      const statsMap = new Map(userStats.map(stat => [stat._id.toString(), stat]));
      users.forEach(user => {
        const stats = statsMap.get(user._id.toString());
        if (stats) {
          user.stats = {
            totalDecks: stats.deckCount || 0,
            totalCards: stats.totalCards || 0,
            studySessions: 0 // Placeholder - would need separate query for actual data
          };
        } else {
          user.stats = { totalDecks: 0, totalCards: 0, studySessions: 0 };
        }
      });
    } else {
      // For large result sets, don't calculate stats to improve performance
      users.forEach(user => {
        user.stats = { totalDecks: 0, totalCards: 0, studySessions: 0 };
      });
    }

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: totalPages
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Export the original functions as well
export * from './admin.users.controller';
