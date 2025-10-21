import { Request, Response } from 'express';
import openaiClient, { createGPT5Response } from '../config/openai';
import User from '../models/User';
import { PLAN_RULES, currentPeriodKey } from '../utils/plan';
import { getPlanRulesForId } from '../utils/getPlanRules'
import mongoose from 'mongoose';
import { Quiz, Note } from '../models';
import type { IQuiz, IQuizAttempt } from '../models/Quiz';
// Removed old credit system import - using new dynamic system only
import { deductFeatureCredits, refundFeatureCredits } from '../utils/dynamicCredits';
import { CREDIT_COSTS } from '../config/credits';
import { checkAiGenerationLimit, checkDailyAiLimit, checkMonthlyAiLimit } from '../utils/planLimits';
import StudySession from '../models/StudySession';

// Create a new quiz
export const createQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== MANUAL QUIZ CREATION STARTED ===');
    console.log('Request body keys:', Object.keys(req.body));
    
    // Charge credits for manual quiz creation using dynamic system
    console.log('About to deduct manual quiz credits...');
    const creditResult = await deductFeatureCredits(req.user._id, 'aiQuizzes', CREDIT_COSTS.quizCreation);
    if (!creditResult.success) {
      console.log('Manual quiz credit deduction failed:', creditResult.message);
      res.status(403).json({ 
        success: false, 
        message: creditResult.message || 'Insufficient manual quiz credits. Please upgrade your plan.'
      });
      return;
    }
    console.log('Manual quiz credit deduction successful. Remaining:', creditResult.remaining);

    const quizData = {
      ...req.body,
      owner: req.user._id,
    };

    console.log('Quiz data being saved:', quizData);
    const quiz = await Quiz.create(quizData);
    console.log('Quiz created successfully:', quiz);
    
    res.status(201).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    // Attempt to refund credits on failure
    try { 
      await refundFeatureCredits(req.user._id, 'aiQuizzes', CREDIT_COSTS.quizCreation);
      console.log('Manual quiz credits refunded due to creation failure');
    } catch (refundError) {
      console.error('Failed to refund manual quiz credits:', refundError);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create quiz',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

// Get all quizzes for a user
export const getQuizzes = async (req: Request, res: Response): Promise<void> => {
  try {
    const quizzes = await Quiz.find({ owner: req.user._id })
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quizzes',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

// Get a single quiz by ID
export const getQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    console.log('Fetching quiz:', id, 'userId:', userId);

    // Try to find quiz by its ID first
    let quiz = await Quiz.findOne({ _id: id, owner: userId });

    // If not found, try to find by noteId (for note-specific quizzes)
    if (!quiz) {
      quiz = await Quiz.findOne({ noteId: id, owner: userId });
    }

    if (!quiz) {
      console.log('Quiz not found');
      res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
      return;
    }

    console.log('Found quiz:', quiz.title);

    // Frontend expects { success, quiz }
    res.status(200).json({
      success: true,
      quiz
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz. Please try again.'
    });
  }
};

// Update a quiz
export const updateQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      res.status(404).json({
        success: false,
        message: 'Quiz not found',
      });
      return;
    }

    // Check ownership
    if (quiz.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({
        success: false,
        message: 'Not authorized to update this quiz',
      });
      return;
    }

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedQuiz,
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quiz',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

// Delete a quiz
export const deleteQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      res.status(404).json({
        success: false,
        message: 'Quiz not found',
      });
      return;
    }

    // Check ownership
    if (quiz.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({
        success: false,
        message: 'Not authorized to delete this quiz',
      });
      return;
    }

    await Quiz.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Quiz deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quiz',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

// Submit a quiz attempt
export const submitQuizAttempt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { answers, shortAnswerTexts, timeSpentPerQuestion } = req.body;
    const userId = req.user._id;

    console.log('Submitting quiz attempt:', { quizId: id, userId, answers, shortAnswerTexts, timeSpentPerQuestion });

    if (!Array.isArray(answers)) {
      res.status(400).json({
        success: false,
        message: 'Invalid answers format'
      });
      return;
    }

    // Try to find quiz by its ID first, then by noteId if not found
    let quiz = await Quiz.findOne({ _id: id, owner: userId });
    if (!quiz) {
      quiz = await Quiz.findOne({ noteId: id, owner: userId });
    }

    if (!quiz) {
      res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
      return;
    }

    // Helper function to evaluate short-answer questions
    const evaluateShortAnswer = (userAnswer: string, correctAnswer: string): boolean => {
      if (!userAnswer || !correctAnswer) return false;
      
      const normalize = (text: string) => text.toLowerCase().trim().replace(/[^\w\s]/g, '');
      const normalizedUser = normalize(userAnswer);
      const normalizedCorrect = normalize(correctAnswer);
      
      // Exact match
      if (normalizedUser === normalizedCorrect) return true;
      
      // Check if user answer contains the correct answer or vice versa
      if (normalizedUser.includes(normalizedCorrect) || normalizedCorrect.includes(normalizedUser)) {
        return true;
      }
      
      // Check for similar words (simple keyword matching)
      const userWords = normalizedUser.split(/\s+/);
      const correctWords = normalizedCorrect.split(/\s+/);
      
      // If correct answer is a single word, check if it's in user's answer
      if (correctWords.length === 1 && userWords.includes(correctWords[0])) {
        return true;
      }
      
      // For multi-word answers, check if most key words match
      if (correctWords.length > 1) {
        const matchingWords = correctWords.filter(word => userWords.includes(word));
        return matchingWords.length >= Math.ceil(correctWords.length * 0.6); // 60% match threshold
      }
      
      return false;
    };

    // Calculate score and prepare detailed answers
    let score = 0;
    const correctAnswers = quiz.questions.map(q => q.correctOptionIndex);
    const explanations = quiz.questions.map(q => q.explanation || '');
    const detailedAnswers = answers.map((answer, index) => {
      const question = quiz.questions[index];
      let isCorrect = false;
      
      if (question.type === 'short-answer') {
        // For short-answer questions, compare the actual text
        const userText = shortAnswerTexts?.[index] || '';
        const correctText = question.options[0] || ''; // Correct answer is stored in options[0]
        isCorrect = evaluateShortAnswer(userText, correctText);
        console.log(`Short-answer evaluation: "${userText}" vs "${correctText}" = ${isCorrect}`);
      } else {
        // For multiple-choice and true-false, compare indices
        isCorrect = answer === question.correctOptionIndex;
      }
      
      return {
        isCorrect,
        timeTaken: timeSpentPerQuestion?.[index] || 0,
        questionIndex: index,
        selectedAnswer: answer,
        userText: shortAnswerTexts?.[index] || null, // Include user's text for short-answer
        correctAnswer: question.correctOptionIndex,
        correctText: question.type === 'short-answer' ? question.options[0] : null, // Include correct text for short-answer
        explanation: question.explanation || ''
      };
    });

    score = detailedAnswers.filter(a => a.isCorrect).length;
    const totalTimeSpent = timeSpentPerQuestion?.reduce((sum: number, time: number) => sum + time, 0) || 0;

    // Create attempt object
    const attempt: IQuizAttempt = {
      userId,
      score: (score / quiz.questions.length) * 100,
      completedAt: new Date(),
      timeSpent: totalTimeSpent,
      answers: answers.map((answer, index) => ({
        questionIndex: index,
        selectedOption: answer,
        isCorrect: answer === quiz.questions[index].correctOptionIndex,
        timeSpent: timeSpentPerQuestion?.[index] || 0
      }))
    };

    // Add attempt to quiz - use quiz._id since we have the quiz object now
    await Quiz.findByIdAndUpdate(
      quiz._id,
      { $push: { attempts: attempt } }
    );

    // Create a study session for this quiz attempt (only for deck-based quizzes)
    if (quiz.deckId) {
      try {
        await StudySession.create({
          userId,
          deckId: quiz.deckId,
          sessionType: 'quiz',
          startTime: new Date(Date.now() - totalTimeSpent * 1000), // Approximate start time
          endTime: new Date(),
          duration: totalTimeSpent,
          cardsStudied: quiz.questions.length,
          correctAnswers: score,
          totalAnswers: quiz.questions.length,
          accuracy: (score / quiz.questions.length) * 100,
          isCompleted: true,
          studyMode: {
            cardOrder: 'sequential',
            cardDirection: 'front-to-back',
            showProgress: true
          },
          performance: {
            easyCards: 0,
            mediumCards: 0,
            hardCards: 0,
            skippedCards: 0
          }
        });
        console.log('Study session created for deck-based quiz attempt');
      } catch (sessionError) {
        console.error('Failed to create study session for quiz:', sessionError);
        // Don't fail the quiz submission if study session creation fails
      }
    } else {
      console.log('Skipping study session creation for note-based quiz (no deckId)');
    }

    console.log('Quiz attempt submitted successfully:', {
      score,
      totalQuestions: quiz.questions.length,
      totalTimeSpent
    });

    res.status(200).json({
      success: true,
      score: (score / quiz.questions.length) * 100,
      totalQuestions: quiz.questions.length,
      correctAnswers,
      explanations,
      detailedAnswers,
      totalTimeSpent,
      passed: (score / quiz.questions.length) * 100 >= (quiz.passingScore || 60)
    });
  } catch (error) {
    console.error('Error submitting quiz attempt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit quiz attempt. Please try again.'
    });
  }
};

// Get public quizzes
export const getPublicQuizzes = async (req: Request, res: Response): Promise<void> => {
  try {
    const quizzes = await Quiz.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.status(200).json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    console.error('Error fetching public quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public quizzes',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

// Search quizzes
export const searchQuizzes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, tags, difficulty } = req.query;
    
    const searchQuery: any = {
      $or: [
        { isPublic: true },
        { owner: req.user._id },
      ],
    };

    if (query) {
      searchQuery.$or.push(
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      );
    }

    if (tags) {
      searchQuery.tags = { $in: (tags as string).split(',') };
    }

    if (difficulty) {
      searchQuery.difficulty = difficulty;
    }

    const quizzes = await Quiz.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    console.error('Error searching quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search quizzes',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export const generateQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { numQuestions = 10 } = req.body; // Default to 10 questions if not specified
    const userId = req.user._id;

    // Check AI generation limits before proceeding
    const aiLimitCheck = await checkAiGenerationLimit(userId);
    if (!aiLimitCheck.allowed) {
      res.status(403).json({ 
        success: false,
        message: aiLimitCheck.message,
        currentCount: aiLimitCheck.currentCount,
        maxAllowed: aiLimitCheck.maxAllowed === Infinity ? 'unlimited' : aiLimitCheck.maxAllowed
      });
      return;
    }

    const dailyLimitCheck = await checkDailyAiLimit(userId);
    if (!dailyLimitCheck.allowed) {
      res.status(403).json({ 
        success: false,
        message: dailyLimitCheck.message,
        currentCount: dailyLimitCheck.currentCount,
        maxAllowed: dailyLimitCheck.maxAllowed === Infinity ? 'unlimited' : dailyLimitCheck.maxAllowed
      });
      return;
    }

    const monthlyLimitCheck = await checkMonthlyAiLimit(userId);
    if (!monthlyLimitCheck.allowed) {
      res.status(403).json({ 
        success: false,
        message: monthlyLimitCheck.message,
        currentCount: monthlyLimitCheck.currentCount,
        maxAllowed: monthlyLimitCheck.maxAllowed === Infinity ? 'unlimited' : monthlyLimitCheck.maxAllowed
      });
      return;
    }

    // Charge credits for quiz generation using dynamic system
    console.log('About to deduct quiz credits...');
    const creditResult = await deductFeatureCredits(userId, 'aiQuizzes', CREDIT_COSTS.quizGeneration);
    if (!creditResult.success) {
      console.log('Quiz credit deduction failed:', creditResult.message);
      res.status(403).json({ 
        success: false, 
        message: creditResult.message || 'Insufficient quiz credits. Please upgrade your plan.' 
      });
      return;
    }
    console.log('Quiz credit deduction successful. Remaining:', creditResult.remaining);

    // Validate numQuestions
    const questionCount = Math.min(Math.max(1, Number(numQuestions)), 100);

    console.log('Generating quiz for note:', id, 'userId:', userId, 'numQuestions:', questionCount);

    // Fetch the note
    const note = await Note.findOne({ _id: id, userId });
    if (!note) {
      console.log('Note not found');
      res.status(404).json({
        success: false,
        message: 'Note not found'
      });
      return;
    }

    console.log('Found note:', note.title);

    // Generate quiz using GPT-5
    const quizPrompt = `You are an expert quiz creator. Create a quiz based on the provided notes. 
Generate ${questionCount} multiple-choice questions. For each question:
1. Create a clear, specific question
2. Provide 4 options, with only one correct answer
3. Include a brief explanation for the correct answer
Format the response as a JSON object with a questions array:
{
  "questions": [
    {
      "question": "the question text",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": 0,
      "explanation": "explanation for the correct answer"
    }
  ]
}

Create a quiz based on these notes:

${note.content}`;

    const response = await createGPT5Response(quizPrompt, 'high', 'medium');

    console.log('OpenAI response received');

    const quizData = JSON.parse(response.choices[0].message.content || '{}');
    
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error('Invalid quiz data format received from OpenAI');
    }

    // Normalize questions to match schema
    const normalizedQuestions = quizData.questions.map((q: any) => {
      const rawType = (q.type || '').toString().toLowerCase().replace(/\s+/g, '-').replace('true/false', 'true-false')
      const type: 'multiple-choice' | 'true-false' | 'short-answer' =
        rawType === 'true-false' ? 'true-false' : rawType === 'short-answer' ? 'short-answer' : 'multiple-choice'

      if (type === 'true-false') {
        const correct = typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex :
          (typeof q.correctAnswer === 'number' ? q.correctAnswer : (String(q.answer || '').toLowerCase().startsWith('t') ? 0 : 1))
        return {
          question: String(q.question || 'Untitled question'),
          options: ['True', 'False'],
          correctOptionIndex: correct === 0 ? 0 : 1,
          explanation: String(q.explanation || ''),
          type,
          difficulty: ['beginner','intermediate','advanced'].includes((q.difficulty||'').toString()) ? q.difficulty : 'intermediate',
        }
      }

      if (type === 'short-answer') {
        const answer = String(q.answer || (Array.isArray(q.options) && q.options.length > 0 ? q.options[0] : '')).trim()
        return {
          question: String(q.question || 'Untitled question'),
          options: [answer],
          correctOptionIndex: 0,
          explanation: String(q.explanation || ''),
          type,
          difficulty: ['beginner','intermediate','advanced'].includes((q.difficulty||'').toString()) ? q.difficulty : 'intermediate',
        }
      }

      // multiple-choice default
      const options = Array.isArray(q.options) ? q.options.map((o: any) => String(o ?? '')) : []
      const nonEmptyOptions = options.filter((o: string) => o.trim() !== '')
      return {
        question: String(q.question || 'Untitled question'),
        options: nonEmptyOptions.length >= 2 ? nonEmptyOptions : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex :
          (typeof q.correctAnswer === 'number' ? q.correctAnswer : 0),
        explanation: String(q.explanation || ''),
        type,
        difficulty: ['beginner','intermediate','advanced'].includes((q.difficulty||'').toString()) ? q.difficulty : 'intermediate',
      }
    })

    console.log('Creating quiz in database');

    // Create or update quiz in database (use 'owner' field as per schema)
    const quiz = await Quiz.findOneAndUpdate(
      { noteId: id, owner: userId },
      {
        title: `Quiz: ${note.title}`,
        noteId: id,
        owner: userId,
        questions: normalizedQuestions,
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Increment monthly usage counter for quizzes
    await User.findByIdAndUpdate(userId, {
      $set: { 'subscription.usage.monthKey': currentPeriodKey() },
      $inc: { 'subscription.usage.quizzesGenerated': 1 },
    })

    console.log('Quiz created successfully');

    res.status(200).json({
      success: true,
      quiz
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    
    // Refund credits if quiz generation failed
    try {
      await refundFeatureCredits(req.user._id, 'aiQuizzes', CREDIT_COSTS.quizGeneration);
      console.log('Quiz credits refunded due to generation failure');
    } catch (refundError) {
      console.error('Failed to refund quiz credits:', refundError);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate quiz. Please try again.'
    });
  }
}; 