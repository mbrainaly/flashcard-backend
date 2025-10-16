import { Request, Response } from 'express';
import StudySession from '../models/StudySession';
import Quiz from '../models/Quiz';
import mongoose from 'mongoose';

// @desc    Create a new study session
// @route   POST /api/study-sessions
// @access  Private
export const createStudySession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deckId, sessionType, studyMode } = req.body;
    const userId = req.user._id;

    const studySession = await StudySession.create({
      userId,
      deckId,
      sessionType: sessionType || 'flashcard',
      studyMode: studyMode || {
        cardOrder: 'sequential',
        cardDirection: 'front-to-back',
        showProgress: true
      }
    });

    res.status(201).json({
      success: true,
      data: studySession
    });
  } catch (error) {
    console.error('Error creating study session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create study session'
    });
  }
};

// @desc    Update study session (when completed)
// @route   PUT /api/study-sessions/:id
// @access  Private
export const updateStudySession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { 
      endTime, 
      duration, 
      cardsStudied, 
      correctAnswers, 
      totalAnswers, 
      isCompleted,
      performance 
    } = req.body;
    const userId = req.user._id;

    const studySession = await StudySession.findOneAndUpdate(
      { _id: id, userId },
      {
        endTime: endTime || new Date(),
        duration,
        cardsStudied,
        correctAnswers,
        totalAnswers,
        isCompleted: isCompleted !== undefined ? isCompleted : true,
        performance
      },
      { new: true }
    );

    if (!studySession) {
      res.status(404).json({
        success: false,
        message: 'Study session not found'
      });
      return;
    }

    res.json({
      success: true,
      data: studySession
    });
  } catch (error) {
    console.error('Error updating study session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update study session'
    });
  }
};

// @desc    Get study sessions for a deck
// @route   GET /api/decks/:deckId/study-sessions
// @access  Private
export const getDeckStudySessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deckId } = req.params;
    const userId = req.user._id;

    const studySessions = await StudySession.find({
      userId,
      deckId,
      isCompleted: true
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: studySessions
    });
  } catch (error) {
    console.error('Error fetching deck study sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study sessions'
    });
  }
};

// @desc    Get study session statistics for a deck
// @route   GET /api/decks/:deckId/study-stats
// @access  Private
export const getDeckStudyStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deckId } = req.params;
    const userId = req.user._id;

    // Get study sessions for this deck
    const studySessions = await StudySession.find({
      userId,
      deckId,
      isCompleted: true
    });

    // Get quiz attempts for this deck
    const quizzes = await Quiz.find({
      owner: userId,
      deckId
    }).select('attempts');

    let totalSessions = studySessions.length;
    let totalCorrect = 0;
    let totalAttempts = 0;

    // Calculate from study sessions
    studySessions.forEach(session => {
      totalCorrect += session.correctAnswers;
      totalAttempts += session.totalAnswers;
    });

    // Calculate from quiz attempts
    quizzes.forEach(quiz => {
      if (quiz.attempts && quiz.attempts.length > 0) {
        totalSessions += quiz.attempts.length;
        quiz.attempts.forEach(attempt => {
          if (attempt.answers) {
            attempt.answers.forEach(answer => {
              totalAttempts++;
              if (answer.isCorrect) {
                totalCorrect++;
              }
            });
          }
        });
      }
    });

    const accuracyPercentage = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalSessions,
        accuracyPercentage,
        totalCorrect,
        totalAttempts,
        studySessionsCount: studySessions.length,
        quizAttemptsCount: quizzes.reduce((sum, quiz) => sum + (quiz.attempts?.length || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching deck study stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study statistics'
    });
  }
};

// @desc    Get all study sessions for a user
// @route   GET /api/study-sessions
// @access  Private
export const getUserStudySessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const { limit = 50, page = 1 } = req.query;

    const studySessions = await StudySession.find({ userId })
      .populate('deckId', 'title description')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await StudySession.countDocuments({ userId });

    res.json({
      success: true,
      data: studySessions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching user study sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study sessions'
    });
  }
};
