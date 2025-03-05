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
exports.explainConcept = exports.answerQuestion = exports.generateQuiz = exports.analyzeQuizContent = exports.explainFlashcard = exports.generateQuizQuestion = exports.evaluateAnswer = exports.analyzeContentForFlashcards = exports.generateFlashcardsForDeck = void 0;
const ai_1 = require("../utils/ai");
const Deck_1 = __importDefault(require("../models/Deck"));
const Card_1 = __importDefault(require("../models/Card"));
const spacedRepetition_1 = require("../utils/spacedRepetition");
const openai_1 = __importDefault(require("../config/openai"));
const openai_2 = __importDefault(require("../config/openai"));
// @desc    Generate flashcards for a deck
// @route   POST /api/ai/flashcards/generate
// @access  Private
const generateFlashcardsForDeck = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { deckId, topic, content, numberOfCards, difficulty } = req.body;
        console.log('Received request:', { deckId, topic, numberOfCards, difficulty });
        // Verify deck exists and user owns it
        const deck = yield Deck_1.default.findById(deckId);
        if (!deck) {
            console.log('Deck not found:', deckId);
            res.status(404).json({ message: 'Deck not found' });
            return;
        }
        if (deck.owner.toString() !== req.user._id.toString()) {
            console.log('Unauthorized access. User:', req.user._id, 'Deck owner:', deck.owner);
            res.status(403).json({ message: 'Not authorized to modify this deck' });
            return;
        }
        // Generate flashcards using AI
        console.log('Generating flashcards with OpenAI...');
        const generatedCards = yield (0, ai_1.generateFlashcards)({
            topic,
            content,
            numberOfCards,
            difficulty,
        });
        console.log('Generated cards:', generatedCards.length);
        // Create cards in the database
        console.log('Creating cards in database...');
        const cardPromises = generatedCards.map((cardData) => __awaiter(void 0, void 0, void 0, function* () {
            const srsValues = (0, spacedRepetition_1.initializeCard)();
            return Card_1.default.create(Object.assign(Object.assign({ deck: deckId, createdBy: req.user._id }, cardData), srsValues));
        }));
        const cards = yield Promise.all(cardPromises);
        console.log('Created cards in database:', cards.length);
        // Update deck card count
        deck.totalCards += cards.length;
        yield deck.save();
        console.log('Updated deck card count');
        res.status(201).json(cards);
    }
    catch (error) {
        console.error('Error generating flashcards:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
        }
        res.status(500).json({ message: 'Error generating flashcards', error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
exports.generateFlashcardsForDeck = generateFlashcardsForDeck;
// @desc    Analyze content for flashcard generation
// @route   POST /api/ai/analyze-content
// @access  Private
const analyzeContentForFlashcards = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { content } = req.body;
        if (!content) {
            res.status(400).json({ message: 'Content is required' });
            return;
        }
        const analysis = yield (0, ai_1.analyzeContent)(content);
        res.status(200).json(analysis);
    }
    catch (error) {
        console.error('Error analyzing content:', error);
        res.status(500).json({ message: 'Error analyzing content' });
    }
});
exports.analyzeContentForFlashcards = analyzeContentForFlashcards;
// @desc    Evaluate exam answer
// @route   POST /api/ai/evaluate-answer
// @access  Private
const evaluateAnswer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { cardId, answer, correctAnswer } = req.body;
        const prompt = `
      You are an AI tutor evaluating a student's answer. Please analyze the following:

      Correct answer: "${correctAnswer}"
      Student's answer: "${answer}"

      Provide a detailed evaluation including:
      1. A score from 0 to 5 based on accuracy and completeness
      2. A clear explanation of what was good and what needs improvement
      3. Specific suggestions for better understanding

      Format your response as a JSON object with the following structure:
      {
        "score": number,
        "explanation": string,
        "suggestions": string[]
      }
    `;
        const completion = yield openai_1.default.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful AI tutor that provides detailed feedback on student answers.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            response_format: { type: 'json_object' },
        });
        const evaluation = completion.choices[0].message.content
            ? JSON.parse(completion.choices[0].message.content)
            : { error: "No content returned" };
        res.status(200).json(evaluation);
    }
    catch (error) {
        console.error('Error evaluating answer:', error);
        res.status(500).json({ message: 'Failed to evaluate answer' });
    }
});
exports.evaluateAnswer = evaluateAnswer;
// @desc    Generate quiz question
// @route   POST /api/ai/quiz/generate
// @access  Private
const generateQuizQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { cardId, front, back } = req.body;
        const prompt = `
      Generate a multiple choice question based on this flashcard:
      Front: ${front}
      Back: ${back}

      Create:
      1. A clear question
      2. Four possible answers (one correct, three plausible but incorrect)
      3. The index of the correct answer (0-3)

      Format your response as a JSON object with the following structure:
      {
        "question": string,
        "options": string[],
        "correctIndex": number
      }

      Make sure the options are:
      - Clearly distinct from each other
      - All plausible but only one correct
      - Similar in length and style
      - Not obviously wrong or silly
    `;
        const completion = yield openai_2.default.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful AI tutor that generates engaging multiple choice questions.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            response_format: { type: 'json_object' },
        });
        const quizQuestion = completion.choices[0].message.content
            ? JSON.parse(completion.choices[0].message.content)
            : { error: "No content returned" };
        res.status(200).json(quizQuestion);
    }
    catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({ message: 'Failed to generate quiz question' });
    }
});
exports.generateQuizQuestion = generateQuizQuestion;
const explainFlashcard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { front, back } = req.body;
        if (!front || !back) {
            res.status(400).json({
                success: false,
                message: 'Front and back content are required',
            });
            return;
        }
        const prompt = `Please explain the relationship between this flashcard's question and answer:
    
Question: ${front}
Answer: ${back}

Provide a clear, concise explanation that helps understand why this answer is correct and how it relates to the question. Include any relevant context or concepts that would help someone understand this better.`;
        const response = yield openai_1.default.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful AI tutor explaining the relationship between flashcard questions and answers. Keep explanations clear, concise, and focused on helping the student understand the connection between the question and answer.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            max_tokens: 250,
            temperature: 0.7,
        });
        const explanation = ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || 'No explanation available.';
        res.status(200).json({
            success: true,
            explanation,
        });
    }
    catch (error) {
        console.error('Error in explainFlashcard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate explanation',
        });
    }
});
exports.explainFlashcard = explainFlashcard;
// @desc    Analyze content for quiz generation
// @route   POST /api/ai/analyze-quiz-content
// @access  Private
const analyzeQuizContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { content } = req.body;
        const prompt = `
      Analyze the following content for quiz generation:

      ${content}

      Provide:
      1. A list of key concepts from the content
      2. Suggested topics for quiz questions
      3. Recommended difficulty level (beginner, intermediate, or advanced)
      4. Estimated number of meaningful quiz questions that can be generated

      Format your response as a JSON object with the following structure:
      {
        "keyConcepts": string[],
        "suggestedTopics": string[],
        "recommendedDifficulty": string,
        "estimatedQuestions": number
      }

      Guidelines:
      - Extract 3-5 key concepts
      - Suggest 4-6 specific topics for questions
      - Base difficulty on content complexity
      - Estimate questions based on content depth
    `;
        const completion = yield openai_1.default.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert content analyzer specializing in educational assessment.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            response_format: { type: 'json_object' },
        });
        const analysis = completion.choices[0].message.content
            ? JSON.parse(completion.choices[0].message.content)
            : { error: "No content returned" };
        res.status(200).json(analysis);
    }
    catch (error) {
        console.error('Error analyzing quiz content:', error);
        res.status(500).json({ message: 'Failed to analyze content' });
    }
});
exports.analyzeQuizContent = analyzeQuizContent;
// @desc    Generate a complete quiz
// @route   POST /api/ai/generate-quiz-complete
// @access  Private
const generateQuiz = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { content, numberOfQuestions, difficulty, questionTypes } = req.body;
        const prompt = `
      Generate a quiz with ${numberOfQuestions} questions based on this content:

      ${content}

      Requirements:
      - Difficulty level: ${difficulty}
      - Question types: ${questionTypes.join(', ')}
      - Each question should have:
        * Clear and concise wording
        * 4 options (1 correct, 3 plausible but incorrect)
        * Brief explanation of the correct answer
      - Questions should cover different aspects of the content
      - Distribute difficulty evenly
      - Avoid repetitive or overlapping questions

      Format your response as a JSON array of questions with this structure:
      {
        "questions": [
          {
            "question": string,
            "options": string[],
            "correctOptionIndex": number,
            "explanation": string,
            "type": string,
            "difficulty": string
          }
        ]
      }
    `;
        const completion = yield openai_1.default.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert quiz creator specializing in educational assessment.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            response_format: { type: 'json_object' },
        });
        const quiz = completion.choices[0].message.content
            ? JSON.parse(completion.choices[0].message.content)
            : { error: "No content returned" };
        res.status(200).json(quiz);
    }
    catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({ message: 'Failed to generate quiz' });
    }
});
exports.generateQuiz = generateQuiz;
// @desc    Answer questions about notes
// @route   POST /api/ai/answer-question
// @access  Private
const answerQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { question, context } = req.body;
        if (!question || !context) {
            res.status(400).json({
                success: false,
                message: 'Question and context are required'
            });
            return;
        }
        const response = yield openai_2.default.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful study assistant. Your task is to answer questions about the provided study notes.
          
Format your response using semantic HTML with the following structure:
1. Start with a brief direct answer in a <p> tag
2. Use <h2> tags for main sections (if needed)
3. Use <p> tags for detailed explanations
4. Use <blockquote> tags for direct quotes from the notes
5. Use <strong> tags for important terms or concepts
6. Use <ul> and <li> tags for lists
7. If timestamps [XX:XX] are found, include them in the relevant sections
8. Keep the answer well-structured and easy to read
9. Use proper spacing and formatting
10. Ensure all HTML tags are properly closed

Example format:
<p>Brief answer...</p>
<h2>Detailed Explanation</h2>
<p>More detailed information...</p>
<blockquote>Direct quote from notes...</blockquote>
<h2>Key Points</h2>
<ul>
  <li>Point 1...</li>
  <li>Point 2...</li>
</ul>`
                },
                {
                    role: 'user',
                    content: `Context:\n${context}\n\nQuestion: ${question}`
                }
            ],
            temperature: 0.7,
            max_tokens: 1000,
        });
        const answer = response.choices[0].message.content || '';
        res.status(200).json({
            success: true,
            answer
        });
    }
    catch (error) {
        console.error('Error answering question:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to answer question'
        });
    }
});
exports.answerQuestion = answerQuestion;
// @desc    Explain a concept
// @route   POST /api/ai/explain-concept
// @access  Private
const explainConcept = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { concept, subject } = req.body;
        if (!concept) {
            res.status(400).json({
                success: false,
                message: 'Concept is required'
            });
            return;
        }
        const response = yield openai_2.default.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert tutor specializing in ${subject || 'various subjects'}. 
Your task is to explain concepts clearly and thoroughly.

Format your explanation using semantic HTML with the following structure:
1. Start with a brief definition in a <p> tag
2. Use <h2> tags for main sections:
   - Overview
   - Key Components
   - Examples
   - Real-world Applications
   - Common Misconceptions (if any)
3. Use <strong> tags for important terms
4. Use <ul> and <li> tags for lists
5. Use <blockquote> tags for important points or memorable quotes
6. Use <code> tags for formulas or technical terms
7. Keep explanations clear and engaging
8. Use analogies when helpful
9. Include examples that demonstrate practical applications
10. Address common misconceptions if relevant

Example format:
<p>Brief definition...</p>
<h2>Overview</h2>
<p>Detailed explanation...</p>
<h2>Key Components</h2>
<ul>
  <li>Component 1...</li>
  <li>Component 2...</li>
</ul>
<h2>Examples</h2>
<p>Example explanation...</p>
<blockquote>Important point or memorable explanation...</blockquote>`
                },
                {
                    role: 'user',
                    content: `Please explain this concept: ${concept}`
                }
            ],
            temperature: 0.7,
            max_tokens: 1500,
        });
        const explanation = response.choices[0].message.content || '';
        res.status(200).json({
            success: true,
            explanation
        });
    }
    catch (error) {
        console.error('Error explaining concept:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to explain concept'
        });
    }
});
exports.explainConcept = explainConcept;
//# sourceMappingURL=ai.controller.js.map