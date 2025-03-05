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
exports.generateQuizQuestion = exports.evaluateAnswer = void 0;
const openai_1 = __importDefault(require("openai"));
const zod_1 = require("zod");
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
// Validation schemas
const evaluateAnswerSchema = zod_1.z.object({
    cardId: zod_1.z.string(),
    answer: zod_1.z.string(),
    correctAnswer: zod_1.z.string(),
});
const generateQuizSchema = zod_1.z.object({
    cardId: zod_1.z.string(),
    front: zod_1.z.string(),
    back: zod_1.z.string(),
});
// @desc    Evaluate an answer in exam mode
// @route   POST /api/study/evaluate
// @access  Private
const evaluateAnswer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { cardId, answer, correctAnswer } = evaluateAnswerSchema.parse(req.body);
        const prompt = `
      You are an AI tutor evaluating a student's answer. Please provide detailed feedback.

      Question: ${correctAnswer}
      Student's Answer: ${answer}

      Please evaluate the answer and provide:
      1. A score between 0 and 1
      2. A detailed explanation of what was correct and incorrect
      3. Learning tips for improvement
      4. Whether the answer should be considered correct (true/false)

      Format your response as a JSON object with the following structure:
      {
        "score": number,
        "explanation": string,
        "tips": string[],
        "isCorrect": boolean
      }
    `;
        const completion = yield openai.chat.completions.create({
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
        const feedback = completion.choices[0].message.content
            ? JSON.parse(completion.choices[0].message.content)
            : { error: "No content returned" };
        res.status(200).json(feedback);
    }
    catch (error) {
        console.error('Error evaluating answer:', error);
        res.status(500).json({ message: 'Error evaluating answer' });
    }
});
exports.evaluateAnswer = evaluateAnswer;
// @desc    Generate a quiz question
// @route   POST /api/study/quiz/generate
// @access  Private
const generateQuizQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { cardId, front, back } = generateQuizSchema.parse(req.body);
        const prompt = `
      Generate a multiple choice question based on this flashcard:
      Front: ${front}
      Back: ${back}

      Create:
      1. A clear question
      2. Four possible answers (one correct, three plausible but incorrect)
      3. A brief explanation of why the correct answer is right

      Format your response as a JSON object with the following structure:
      {
        "question": string,
        "options": string[],
        "correctIndex": number,
        "explanation": string
      }

      The correct answer should be randomly placed among the options.
    `;
        const completion = yield openai.chat.completions.create({
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
        console.error('Error generating quiz question:', error);
        res.status(500).json({ message: 'Error generating quiz question' });
    }
});
exports.generateQuizQuestion = generateQuizQuestion;
