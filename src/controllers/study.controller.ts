import { Request, Response } from 'express'
import OpenAI from 'openai'
import { createGPT5Response } from '../config/openai'
import { z } from 'zod'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Validation schemas
const evaluateAnswerSchema = z.object({
  cardId: z.string(),
  answer: z.string(),
  correctAnswer: z.string(),
})

const generateQuizSchema = z.object({
  cardId: z.string(),
  front: z.string(),
  back: z.string(),
})

// @desc    Evaluate an answer in exam mode
// @route   POST /api/study/evaluate
// @access  Private
export const evaluateAnswer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cardId, answer, correctAnswer } = evaluateAnswerSchema.parse(req.body)

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
    `

    const studyPrompt = `You are a helpful AI tutor that provides detailed feedback on student answers.

${prompt}`;

    const completion = await createGPT5Response(studyPrompt, 'high', 'medium')

    const feedback = completion.choices[0].message.content 
      ? JSON.parse(completion.choices[0].message.content) 
      : { error: "No content returned" };
    res.status(200).json(feedback)
  } catch (error) {
    console.error('Error evaluating answer:', error)
    res.status(500).json({ message: 'Error evaluating answer' })
  }
}

// @desc    Generate a quiz question
// @route   POST /api/study/quiz/generate
// @access  Private
export const generateQuizQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cardId, front, back } = generateQuizSchema.parse(req.body)

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
    `

    const quizPrompt = `You are a helpful AI tutor that generates engaging multiple choice questions.

${prompt}`;

    const completion = await createGPT5Response(quizPrompt, 'high', 'medium')

    const quizQuestion = completion.choices[0].message.content 
      ? JSON.parse(completion.choices[0].message.content) 
      : { error: "No content returned" };
    res.status(200).json(quizQuestion)
  } catch (error) {
    console.error('Error generating quiz question:', error)
    res.status(500).json({ message: 'Error generating quiz question' })
  }
} 