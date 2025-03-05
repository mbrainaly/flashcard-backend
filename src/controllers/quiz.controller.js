"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQuiz = exports.searchQuizzes = exports.getPublicQuizzes = exports.submitQuizAttempt = exports.deleteQuiz = exports.updateQuiz = exports.getQuiz = exports.getQuizzes = exports.createQuiz = void 0;
const openai_1 = __importDefault(require("../config/openai"));
const models_1 = require("../models");
// Create a new quiz
const createQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quizData = Object.assign(Object.assign({}, req.body), { owner: req.user._id });
        console.log('Quiz data being saved:', quizData);
        const quiz = yield models_1.Quiz.create(quizData);
        console.log('Quiz created successfully:', quiz);
        res.status(201).json({
            success: true,
            data: quiz,
        });
    }
    catch (error) {
        console.error('Error creating quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create quiz',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
exports.createQuiz = createQuiz;
// Get all quizzes for a user
const getQuizzes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quizzes = yield models_1.Quiz.find({ owner: req.user._id })
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: quizzes,
        });
    }
    catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch quizzes',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
exports.getQuizzes = getQuizzes;
// Get a single quiz by ID
const getQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        console.log('Fetching quiz:', id, 'userId:', userId);
        // Try to find quiz by its ID first
        let quiz = yield models_1.Quiz.findOne({ _id: id, owner: userId });
        // If not found, try to find by noteId (for note-specific quizzes)
        if (!quiz) {
            quiz = yield models_1.Quiz.findOne({ noteId: id, owner: userId });
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
            data: quiz // Changed to match the expected response format
        });
    }
    catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch quiz. Please try again.'
        });
    }
});
exports.getQuiz = getQuiz;
// Update a quiz
const updateQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quiz = yield models_1.Quiz.findById(req.params.id);
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
        const updatedQuiz = yield models_1.Quiz.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            data: updatedQuiz,
        });
    }
    catch (error) {
        console.error('Error updating quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update quiz',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
exports.updateQuiz = updateQuiz;
// Delete a quiz
const deleteQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quiz = yield models_1.Quiz.findById(req.params.id);
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
        yield models_1.Quiz.findByIdAndDelete(req.params.id);
        res.status(200).json({
            success: true,
            message: 'Quiz deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete quiz',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
exports.deleteQuiz = deleteQuiz;
// Submit a quiz attempt
const submitQuizAttempt = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        let quiz = yield models_1.Quiz.findOne({ _id: id, owner: userId });
        if (!quiz) {
            quiz = yield models_1.Quiz.findOne({ noteId: id, owner: userId });
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
            timeTaken: (timeSpentPerQuestion === null || timeSpentPerQuestion === void 0 ? void 0 : timeSpentPerQuestion[index]) || 0,
            questionIndex: index,
            selectedAnswer: answer,
            correctAnswer: quiz.questions[index].correctOptionIndex,
            explanation: quiz.questions[index].explanation || ''
        }));
        score = detailedAnswers.filter(a => a.isCorrect).length;
        const totalTimeSpent = (timeSpentPerQuestion === null || timeSpentPerQuestion === void 0 ? void 0 : timeSpentPerQuestion.reduce((sum, time) => sum + time, 0)) || 0;
        // Create attempt object
        const attempt = {
            userId,
            score: (score / quiz.questions.length) * 100,
            completedAt: new Date(),
            timeSpent: totalTimeSpent,
            answers: answers.map((answer, index) => ({
                questionIndex: index,
                selectedOption: answer,
                isCorrect: answer === quiz.questions[index].correctOptionIndex,
                timeSpent: (timeSpentPerQuestion === null || timeSpentPerQuestion === void 0 ? void 0 : timeSpentPerQuestion[index]) || 0
            }))
        };
        // Add attempt to quiz - use quiz._id since we have the quiz object now
        yield models_1.Quiz.findByIdAndUpdate(quiz._id, { $push: { attempts: attempt } });
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
    }
    catch (error) {
        console.error('Error submitting quiz attempt:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit quiz attempt. Please try again.'
        });
    }
});
exports.submitQuizAttempt = submitQuizAttempt;
// Get public quizzes
const getPublicQuizzes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const quizzes = yield models_1.Quiz.find({ isPublic: true })
            .sort({ createdAt: -1 })
            .limit(20);
        res.status(200).json({
            success: true,
            data: quizzes,
        });
    }
    catch (error) {
        console.error('Error fetching public quizzes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch public quizzes',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
exports.getPublicQuizzes = getPublicQuizzes;
// Search quizzes
const searchQuizzes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { query, tags, difficulty } = req.query;
        const searchQuery = {
            $or: [
                { isPublic: true },
                { owner: req.user._id },
            ],
        };
        if (query) {
            searchQuery.$or.push({ title: { $regex: query, $options: 'i' } }, { description: { $regex: query, $options: 'i' } });
        }
        if (tags) {
            searchQuery.tags = { $in: tags.split(',') };
        }
        if (difficulty) {
            searchQuery.difficulty = difficulty;
        }
        const quizzes = yield models_1.Quiz.find(searchQuery)
            .sort({ createdAt: -1 })
            .limit(20);
        res.status(200).json({
            success: true,
            data: quizzes,
        });
    }
    catch (error) {
        console.error('Error searching quizzes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search quizzes',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
exports.searchQuizzes = searchQuizzes;
const generateQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { numQuestions = 10 } = req.body; // Default to 10 questions if not specified
        const userId = req.user._id;
        // Validate numQuestions
        const questionCount = Math.min(Math.max(1, Number(numQuestions)), 100);
        console.log('Generating quiz for note:', id, 'userId:', userId, 'numQuestions:', questionCount);
        // Fetch the note
        const note = yield models_1.Note.findOne({ _id: id, userId });
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
        const response = yield openai_1.default.chat.completions.create({
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
        const quiz = yield models_1.Quiz.findOneAndUpdate({ noteId: id, userId }, {
            title: `Quiz: ${note.title}`,
            noteId: id,
            userId,
            questions: quizData.questions,
        }, { upsert: true, new: true });
        console.log('Quiz created successfully');
        res.status(200).json({
            success: true,
            quiz
        });
    }
    catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate quiz. Please try again.'
        });
    }
});
exports.generateQuiz = generateQuiz;
