import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Deck from '../../models/Deck';
import Card from '../../models/Card';
import Quiz from '../../models/Quiz';
import Note from '../../models/note.model';
import User from '../../models/User';
import { AuthenticatedRequest } from '../../middleware/admin.auth.middleware';

// Deck Management Controllers

export const getAllDecks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      search, 
      category,
      difficulty,
      status,
      author,
      isPublic, 
      owner, 
      tags,
      dateFrom, 
      dateTo,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter: any = {};
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (status) {
      if (status === 'active') filter.isActive = true;
      else if (status === 'inactive') filter.isActive = false;
      else if (status === 'public') filter.isPublic = true;
      else if (status === 'private') filter.isPublic = false;
    }
    if (isPublic !== undefined) filter.isPublic = isPublic === 'true';
    if (owner) filter.owner = owner;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filter.tags = { $in: tagArray };
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }
    if (author) {
      // Search by author name - we'll need to do a lookup
      const users = await User.find({
        $or: [
          { name: { $regex: author, $options: 'i' } },
          { email: { $regex: author, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = users.map(user => user._id);
      if (userIds.length > 0) {
        filter.owner = { $in: userIds };
      } else {
        // No matching users found, return empty result
        filter.owner = null;
      }
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [decks, total] = await Promise.all([
      Deck.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('owner', 'name email avatar')
        .lean(),
      Deck.countDocuments(filter)
    ]);

    // Format decks to match frontend expectations
    const formattedDecks = decks.map(deck => ({
      _id: deck._id,
      title: deck.title,
      description: deck.description,
      author: {
        name: deck.owner?.name || 'Unknown',
        email: deck.owner?.email || 'unknown@example.com'
      },
      category: deck.category || 'Uncategorized',
      difficulty: deck.difficulty || 'beginner',
      isPublic: deck.isPublic,
      isActive: deck.isActive ?? true,
      cardCount: deck.totalCards || 0,
      studyCount: deck.studyCount || 0,
      rating: deck.rating || 0,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      tags: deck.tags || []
    }));

    res.json({
      success: true,
      data: formattedDecks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching decks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch decks'
    });
  }
};

export const getDeckById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const deck = await Deck.findById(id)
      .populate('owner', 'name email avatar createdAt')
      .lean();

    if (!deck) {
      return res.status(404).json({
        success: false,
        message: 'Deck not found'
      });
    }

    // Get cards count and all cards
    const [cardsCount, allCards] = await Promise.all([
      Card.countDocuments({ deck: id }),
      Card.find({ deck: id })
        .sort({ createdAt: -1 })
        .select('front back status createdAt')
        .lean()
    ]);

    // Get deck analytics
    const cardStats = await Card.aggregate([
      { $match: { deck: deck._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const analytics = {
      totalCards: cardsCount,
      cardsByStatus: cardStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, { new: 0, learning: 0, mastered: 0 }),
      recentCards: allCards
    };

    res.json({
      success: true,
      data: {
        deck,
        analytics
      }
    });
  } catch (error) {
    console.error('Error fetching deck:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deck'
    });
  }
};

export const updateDeck = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const deck = await Deck.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('owner', 'name email avatar')
      .lean();

    if (!deck) {
      return res.status(404).json({
        success: false,
        message: 'Deck not found'
      });
    }

    res.json({
      success: true,
      data: deck,
      message: 'Deck updated successfully'
    });
  } catch (error) {
    console.error('Error updating deck:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update deck'
    });
  }
};

export const deleteDeck = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if deck exists
    const deck = await Deck.findById(id);
    if (!deck) {
      return res.status(404).json({
        success: false,
        message: 'Deck not found'
      });
    }

    // Delete all associated cards
    await Card.deleteMany({ deck: id });

    // Delete the deck
    await Deck.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Deck and associated cards deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting deck:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete deck'
    });
  }
};

// Card Management Controllers

export const getAllCards = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      search, 
      deck: deckId,
      difficulty,
      status, 
      author,
      tags,
      dateFrom, 
      dateTo,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter: any = {};
    if (deckId) filter.deck = deckId;
    
    // Map frontend status to backend status
    if (status) {
      if (status === 'active') {
        // Consider cards as active if they're not mastered (still being studied)
        filter.status = { $in: ['new', 'learning'] };
      } else if (status === 'inactive') {
        // Consider mastered cards as inactive
        filter.status = 'mastered';
      }
    }
    
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
    }
    
    if (search) {
      filter.$or = [
        { front: { $regex: search, $options: 'i' } },
        { back: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (tags) {
      filter.tags = { $regex: tags, $options: 'i' };
    }

    // Handle author search
    if (author) {
      const users = await User.find({
        $or: [
          { name: { $regex: author, $options: 'i' } },
          { email: { $regex: author, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = users.map(user => user._id);
      if (userIds.length > 0) {
        filter.createdBy = { $in: userIds };
      } else {
        filter.createdBy = null;
      }
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [cards, total] = await Promise.all([
      Card.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('deck', 'title owner')
        .populate('createdBy', 'name email')
        .lean(),
      Card.countDocuments(filter)
    ]);

    // Format cards to match frontend expectations using consistent analytics
    const formattedCards = cards.map(card => {
      // Use same calculation logic as getCardById for consistency
      const studyCount = card.repetitions || 0;
      const difficulty = mapDifficultyFromStatus(card.status, card.repetitions);
      const isActive = card.status !== 'mastered';
      const estimatedAccuracy = calculateEstimatedAccuracy(card.status, card.easeFactor, card.repetitions);
      const correctCount = Math.round((estimatedAccuracy * studyCount) / 100);

      return {
        _id: card._id,
        front: card.front,
        back: card.back,
        deck: {
          _id: card.deck._id,
          title: card.deck.title
        },
        author: {
          name: card.createdBy?.name || 'Unknown',
          email: card.createdBy?.email || 'unknown@example.com'
        },
        difficulty,
        isActive,
        tags: card.tags || [],
        studyCount,
        correctCount,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        lastStudied: card.lastReviewed || undefined
      };
    });

    // Helper functions (same as in getCardById)
    function mapDifficultyFromStatus(status: string, repetitions: number): 'easy' | 'medium' | 'hard' {
      if (status === 'new' || repetitions === 0) return 'easy';
      if (status === 'mastered' || repetitions >= 5) return 'hard';
      return 'medium';
    }

    function calculateEstimatedAccuracy(status: string, easeFactor: number, repetitions: number): number {
      if (repetitions === 0) return 0;
      
      let baseAccuracy = 0;
      switch (status) {
        case 'new':
          baseAccuracy = 50;
          break;
        case 'learning':
          baseAccuracy = 65;
          break;
        case 'mastered':
          baseAccuracy = 85;
          break;
        default:
          baseAccuracy = 50;
      }
      
      const easeAdjustment = ((easeFactor - 2.5) / 2.5) * 20;
      const finalAccuracy = Math.max(0, Math.min(100, baseAccuracy + easeAdjustment));
      
      return Math.round(finalAccuracy);
    }

    res.json({
      success: true,
      data: formattedCards,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cards'
    });
  }
};

export const getCardById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const card = await Card.findById(id)
      .populate('deck', 'title description owner')
      .populate('createdBy', 'name email avatar')
      .lean();

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    // Calculate analytics based on spaced repetition data
    const analytics = {
      studyCount: card.repetitions || 0,
      lastStudied: card.lastReviewed || null,
      difficulty: mapDifficultyFromStatus(card.status, card.repetitions),
      isActive: card.status !== 'mastered',
      // For spaced repetition, we can estimate performance from easeFactor and status
      estimatedAccuracy: calculateEstimatedAccuracy(card.status, card.easeFactor, card.repetitions),
      learningProgress: {
        status: card.status,
        easeFactor: card.easeFactor,
        interval: card.interval,
        nextReview: card.nextReview
      }
    };

    // Helper function to map difficulty
    function mapDifficultyFromStatus(status: string, repetitions: number): 'easy' | 'medium' | 'hard' {
      if (status === 'new' || repetitions === 0) return 'easy';
      if (status === 'mastered' || repetitions >= 5) return 'hard';
      return 'medium';
    }

    // Helper function to estimate accuracy from spaced repetition data
    function calculateEstimatedAccuracy(status: string, easeFactor: number, repetitions: number): number {
      if (repetitions === 0) return 0;
      
      // Use easeFactor as performance indicator (2.5 is default, higher is better)
      // Status also indicates performance level
      let baseAccuracy = 0;
      
      switch (status) {
        case 'new':
          baseAccuracy = 50; // New cards, assume 50% baseline
          break;
        case 'learning':
          baseAccuracy = 65; // Learning cards, improving
          break;
        case 'mastered':
          baseAccuracy = 85; // Mastered cards, high performance
          break;
        default:
          baseAccuracy = 50;
      }
      
      // Adjust based on easeFactor (2.5 is neutral, higher is better)
      const easeAdjustment = ((easeFactor - 2.5) / 2.5) * 20; // ±20% based on ease
      const finalAccuracy = Math.max(0, Math.min(100, baseAccuracy + easeAdjustment));
      
      return Math.round(finalAccuracy);
    }

    res.json({
      success: true,
      data: {
        ...card,
        analytics
      }
    });
  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch card'
    });
  }
};

export const updateCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const card = await Card.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('deck', 'title')
      .populate('createdBy', 'name email')
      .lean();

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    res.json({
      success: true,
      data: card,
      message: 'Card updated successfully'
    });
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update card'
    });
  }
};

export const deleteCard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const card = await Card.findByIdAndDelete(id);
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    // Update deck's total cards count
    await Deck.findByIdAndUpdate(
      card.deck,
      { $inc: { totalCards: -1 } }
    );

    res.json({
      success: true,
      message: 'Card deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete card'
    });
  }
};

// Quiz Management Controllers

export const getAllQuizzes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      search, 
      deck,
      difficulty,
      status,
      type,
      author,
      isPublic, 
      owner, 
      tags,
      dateFrom, 
      dateTo,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter: any = {};
    if (isPublic !== undefined) filter.isPublic = isPublic === 'true';
    if (owner) filter.owner = owner;
    
    // Map frontend difficulty to backend difficulty
    if (difficulty) {
      const difficultyMap: { [key: string]: string } = {
        'easy': 'beginner',
        'medium': 'intermediate', 
        'hard': 'advanced'
      };
      filter.difficulty = difficultyMap[difficulty] || difficulty;
    }
    
    // Filter by quiz type
    if (type) {
      if (type === 'individual') {
        // For individual type, include quizzes with type='individual' OR type=null/undefined
        filter.type = { $in: ['individual', null] };
      } else {
        filter.type = type;
      }
    }
    
    // Handle status filter
    if (status) {
      if (status === 'active') {
        // Consider quizzes with recent attempts as active
        filter.updatedAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }; // Last 30 days
      } else if (status === 'inactive') {
        filter.updatedAt = { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
      } else if (status === 'public') {
        filter.isPublic = true;
      } else if (status === 'private') {
        filter.isPublic = false;
      }
    }
    
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filter.tags = { $in: tagArray };
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
    }

    // Handle search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Handle author search
    if (author) {
      const users = await User.find({
        $or: [
          { name: { $regex: author, $options: 'i' } },
          { email: { $regex: author, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = users.map(user => user._id);
      if (userIds.length > 0) {
        filter.owner = { $in: userIds };
      } else {
        // If no matching users found, set impossible condition
        filter.owner = new mongoose.Types.ObjectId('000000000000000000000000');
      }
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;


    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('owner', 'name email avatar')
        .populate('noteId', 'title')
        .populate('deckId', 'title')
        .select('-questions.correctOptionIndex -questions.explanation') // Hide answers from list view
        .lean(),
      Quiz.countDocuments(filter)
    ]);


    // Format quizzes to match frontend expectations
    const formattedQuizzes = quizzes.map(quiz => {
      // Calculate analytics from attempts
      const totalAttempts = quiz.attempts?.length || 0;
      const completedAttempts = quiz.attempts?.filter(attempt => 
        attempt.score >= quiz.passingScore
      ) || [];
      const totalCompletions = completedAttempts.length;
      
      const averageScore = totalAttempts > 0 
        ? Math.round((quiz.attempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts) * 10) / 10
        : 0;
        
      const averageTime = totalAttempts > 0
        ? Math.round((quiz.attempts.reduce((sum, attempt) => sum + (attempt.timeSpent / 60), 0) / totalAttempts) * 10) / 10 // Convert to minutes
        : 0;

      // Map backend difficulty to frontend difficulty
      const difficultyMap: { [key: string]: 'easy' | 'medium' | 'hard' } = {
        'beginner': 'easy',
        'intermediate': 'medium',
        'advanced': 'hard'
      };

      // Determine deck information based on quiz type
      let deckInfo = { _id: 'no-deck', title: 'No Associated Deck' };
      if (quiz.type === 'by-notes' && quiz.noteId) {
        deckInfo = {
          _id: quiz.noteId._id,
          title: quiz.noteId.title || 'Associated Note'
        };
      } else if (quiz.type === 'by-deck' && quiz.deckId) {
        deckInfo = {
          _id: quiz.deckId._id,
          title: quiz.deckId.title || 'Associated Deck'
        };
      }

      // Ensure type field exists, default to 'individual' for existing quizzes
      const quizType = quiz.type || 'individual';

      return {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description || '',
        type: quizType, // Quiz generation type
        deck: deckInfo,
        author: {
          name: quiz.owner?.name || 'Unknown',
          email: quiz.owner?.email || 'unknown@example.com'
        },
        difficulty: difficultyMap[quiz.difficulty] || 'medium',
        isActive: quiz.updatedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Active if updated in last 30 days
        isPublic: quiz.isPublic,
        questionCount: quiz.questions?.length || 0,
        timeLimit: quiz.timeLimit || 0,
        passingScore: quiz.passingScore,
        attempts: totalAttempts,
        completions: totalCompletions,
        averageScore,
        averageTime,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
        tags: quiz.tags || []
      };
    });

    res.json({
      success: true,
      data: formattedQuizzes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quizzes'
    });
  }
};

export const getQuizById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const quiz = await Quiz.findById(id)
      .populate('owner', 'name email avatar createdAt')
      .populate('noteId', 'title content')
      .lean();

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Calculate quiz analytics
    const analytics = {
      totalQuestions: quiz.questions.length,
      totalAttempts: quiz.attempts.length,
      averageScore: quiz.attempts.length > 0 
        ? quiz.attempts.reduce((sum, attempt) => sum + attempt.score, 0) / quiz.attempts.length 
        : 0,
      averageTimeSpent: quiz.attempts.length > 0
        ? quiz.attempts.reduce((sum, attempt) => sum + attempt.timeSpent, 0) / quiz.attempts.length
        : 0,
      recentAttempts: quiz.attempts
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
        .slice(0, 5)
    };

    res.json({
      success: true,
      data: {
        quiz,
        analytics
      }
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz'
    });
  }
};

export const updateQuiz = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const quiz = await Quiz.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('owner', 'name email')
      .populate('noteId', 'title')
      .lean();

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    res.json({
      success: true,
      data: quiz,
      message: 'Quiz updated successfully'
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz'
    });
  }
};

export const deleteQuiz = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const quiz = await Quiz.findByIdAndDelete(id);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quiz'
    });
  }
};

// Notes Management Controllers

export const getAllNotes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      search, 
      category,
      status,
      author,
      userId,
      dateFrom, 
      dateTo,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter: any = {};
    if (userId) filter.userId = userId;
    
    // Category filter
    if (category) filter.category = category;
    
    // Status filter
    if (status) {
      if (status === 'active') {
        filter.isActive = true;
      } else if (status === 'inactive') {
        filter.isActive = false;
      } else if (status === 'public') {
        filter.isPublic = true;
      } else if (status === 'private') {
        filter.isPublic = false;
      } else if (status === 'generated') {
        filter.generatedAt = { $ne: null };
      }
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
    }
    
    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Handle author search
    if (author) {
      const users = await User.find({
        $or: [
          { name: { $regex: author, $options: 'i' } },
          { email: { $regex: author, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = users.map(user => user._id);
      if (userIds.length > 0) {
        filter.userId = { $in: userIds };
      } else {
        // If no matching users found, set impossible condition
        filter.userId = new mongoose.Types.ObjectId('000000000000000000000000');
      }
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [notes, total] = await Promise.all([
      Note.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'name email avatar')
        .lean(),
      Note.countDocuments(filter)
    ]);

    // Format notes to match frontend expectations
    const formattedNotes = notes.map(note => ({
      _id: note._id,
      title: note.title,
      content: note.content.length > 200 ? note.content.substring(0, 200) + '...' : note.content,
      summary: note.summary || '',
      author: {
        name: note.userId?.name || 'Unknown',
        email: note.userId?.email || 'unknown@example.com'
      },
      source: note.source || { type: 'manual', name: 'Manual Entry' },
      category: note.category || 'General',
      isActive: note.isActive ?? true,
      isPublic: note.isPublic ?? false,
      wordCount: note.wordCount || 0,
      readingTime: note.readingTime || 1,
      generatedAt: note.generatedAt,
      viewCount: note.viewCount || 0,
      downloadCount: note.downloadCount || 0,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      tags: note.tags || []
    }));

    res.json({
      success: true,
      data: formattedNotes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notes'
    });
  }
};

export const getNoteById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const note = await Note.findById(id)
      .populate('userId', 'name email avatar createdAt')
      .lean();

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Check if there are any quizzes associated with this note
    const associatedQuizzes = await Quiz.find({ noteId: id })
      .select('title difficulty createdAt')
      .lean();

    // Format note to match frontend expectations
    const formattedNote = {
      _id: note._id,
      title: note.title,
      content: note.content, // Full content for detail view
      summary: note.summary || '',
      author: {
        name: note.userId?.name || 'Unknown',
        email: note.userId?.email || 'unknown@example.com'
      },
      source: note.source || { type: 'manual', name: 'Manual Entry' },
      category: note.category || 'General',
      isActive: note.isActive ?? true,
      isPublic: note.isPublic ?? false,
      wordCount: note.wordCount || 0,
      readingTime: note.readingTime || 1,
      generatedAt: note.generatedAt,
      viewCount: note.viewCount || 0,
      downloadCount: note.downloadCount || 0,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      tags: note.tags || []
    };

    res.json({
      success: true,
      data: {
        note: formattedNote,
        associatedQuizzes
      }
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch note'
    });
  }
};

export const updateNote = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const note = await Note.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('userId', 'name email')
      .lean();

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Format note to match frontend expectations
    const formattedNote = {
      _id: note._id,
      title: note.title,
      content: note.content,
      summary: note.summary || '',
      author: {
        name: note.userId?.name || 'Unknown',
        email: note.userId?.email || 'unknown@example.com'
      },
      source: note.source || { type: 'manual', name: 'Manual Entry' },
      category: note.category || 'General',
      isActive: note.isActive ?? true,
      isPublic: note.isPublic ?? false,
      wordCount: note.wordCount || 0,
      readingTime: note.readingTime || 1,
      generatedAt: note.generatedAt,
      viewCount: note.viewCount || 0,
      downloadCount: note.downloadCount || 0,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      tags: note.tags || []
    };

    res.json({
      success: true,
      data: formattedNote,
      message: 'Note updated successfully'
    });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update note'
    });
  }
};

export const deleteNote = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const note = await Note.findByIdAndDelete(id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Also delete any associated quizzes
    await Quiz.deleteMany({ noteId: id });

    res.json({
      success: true,
      message: 'Note and associated quizzes deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete note'
    });
  }
};

// Content Statistics Controller

export const getContentStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate) dateFilter.$lte = new Date(endDate as string);

    // Get basic counts
    const [
      totalDecks,
      totalCards,
      totalQuizzes,
      totalNotes,
      totalUsers,
      publicDecks,
      publicQuizzes
    ] = await Promise.all([
      Deck.countDocuments(),
      Card.countDocuments(),
      Quiz.countDocuments(),
      Note.countDocuments(),
      User.countDocuments(),
      Deck.countDocuments({ isPublic: true }),
      Quiz.countDocuments({ isPublic: true })
    ]);

    // Get content creation trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const contentTrends = await Promise.all([
      Deck.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Card.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Quiz.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Note.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Get top creators
    const topCreators = await Deck.aggregate([
      {
        $group: {
          _id: '$owner',
          deckCount: { $sum: 1 }
        }
      },
      { $sort: { deckCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          deckCount: 1,
          'user.name': 1,
          'user.email': 1
        }
      }
    ]);

    // Get most popular tags
    const popularTags = await Deck.aggregate([
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Card status distribution
    const cardStatusDistribution = await Card.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Quiz difficulty distribution
    const quizDifficultyDistribution = await Quiz.aggregate([
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      overview: {
        totalDecks,
        totalCards,
        totalQuizzes,
        totalNotes,
        totalUsers,
        publicDecks,
        publicQuizzes,
        averageCardsPerDeck: totalDecks > 0 ? Math.round(totalCards / totalDecks) : 0
      },
      trends: {
        decks: contentTrends[0],
        cards: contentTrends[1],
        quizzes: contentTrends[2],
        notes: contentTrends[3]
      },
      topCreators,
      popularTags,
      distributions: {
        cardStatus: cardStatusDistribution,
        quizDifficulty: quizDifficultyDistribution
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching content statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch content statistics'
    });
  }
};
