import { Request, Response } from 'express';
import openaiClient from '../config/openai';
import { Quiz, Note } from '../models';
import type { IQuiz, IQuizAttempt } from '../models/Quiz';

// Create a new quiz
export const createQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
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

    res.status(200).json({
      success: true,
      data: quiz  // Changed to match the expected response format
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
    const { answers, timeSpentPerQuestion } = req.body;
    const userId = req.user._id;

    console.log('Submitting quiz attempt:', { quizId: id, userId, answers, timeSpentPerQuestion });

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

    // Calculate score and prepare detailed answers
    let score = 0;
    const correctAnswers = quiz.questions.map(q => q.correctOptionIndex);
    const explanations = quiz.questions.map(q => q.explanation || '');
    const detailedAnswers = answers.map((answer, index) => ({
      isCorrect: answer === quiz.questions[index].correctOptionIndex,
      timeTaken: timeSpentPerQuestion?.[index] || 0,
      questionIndex: index,
      selectedAnswer: answer,
      correctAnswer: quiz.questions[index].correctOptionIndex,
      explanation: quiz.questions[index].explanation || ''
    }));

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

    // Generate quiz using OpenAI
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an expert quiz creator. Create a quiz based on the provided notes. 
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
          }`
        },
        {
          role: 'user',
          content: `Create a quiz based on these notes:\n\n${note.content}`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    console.log('OpenAI response received');

    const quizData = JSON.parse(response.choices[0].message.content || '{}');
    
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error('Invalid quiz data format received from OpenAI');
    }

    console.log('Creating quiz in database');

    // Create quiz in database
    const quiz = await Quiz.findOneAndUpdate(
      { noteId: id, userId },
      {
        title: `Quiz: ${note.title}`,
        noteId: id,
        userId,
        questions: quizData.questions,
      },
      { upsert: true, new: true }
    );

    console.log('Quiz created successfully');

    res.status(200).json({
      success: true,
      quiz
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate quiz. Please try again.'
    });
  }
}; 