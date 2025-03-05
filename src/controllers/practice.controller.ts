import { Request, Response } from 'express'
import openaiClient from '../config/openai'

// @desc    Generate practice problems
// @route   POST /api/ai/generate-problems
// @access  Private
export const generateProblems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject, topic, difficulty, numProblems } = req.body

    if (!subject || !topic || !difficulty || !numProblems) {
      res.status(400).json({
        success: false,
        message: 'All fields are required'
      })
      return
    }

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert tutor specializing in generating practice problems. Create ${numProblems} ${difficulty} level problems about ${topic} in ${subject}.

For each problem:
1. Create a clear, concise question
2. For appropriate problems, provide multiple choice options
3. Include the correct answer
4. Add a detailed explanation
5. Ensure the difficulty matches the requested level
6. Make problems engaging and relevant

Return the problems as a JSON array with this structure:
{
  "problems": [
    {
      "id": string (uuid),
      "question": string,
      "options": string[] (optional),
      "correctAnswer": string,
      "explanation": string,
      "difficulty": "easy" | "medium" | "hard",
      "subject": string,
      "topic": string
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Generate ${numProblems} ${difficulty} practice problems about ${topic} in ${subject}.`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    })

    const problems = JSON.parse(response.choices[0].message.content || '{"problems": []}').problems

    res.status(200).json({
      success: true,
      problems
    })
  } catch (error) {
    console.error('Error generating problems:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to generate problems'
    })
  }
}

// @desc    Check answer and provide feedback
// @route   POST /api/ai/check-answer
// @access  Private
export const checkAnswer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { problemId, userAnswer, correctAnswer } = req.body

    if (!userAnswer || !correctAnswer) {
      res.status(400).json({
        success: false,
        message: 'Answer and correct answer are required'
      })
      return
    }

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert tutor evaluating student answers. Analyze the following:

Correct answer: "${correctAnswer}"
Student's answer: "${userAnswer}"

Provide:
1. Whether the answer is correct (exact match or semantically equivalent)
2. A detailed explanation of why it's correct/incorrect
3. Specific next steps or areas to review if incorrect
4. Encouragement and constructive feedback

Return your evaluation as a JSON object with this structure:
{
  "isCorrect": boolean,
  "explanation": string,
  "nextSteps": string[] (if incorrect)
}`
        },
        {
          role: 'user',
          content: `Evaluate this answer:
Correct: "${correctAnswer}"
Student: "${userAnswer}"`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    })

    const evaluation = JSON.parse(response.choices[0].message.content || '{}')

    res.status(200).json({
      success: true,
      ...evaluation
    })
  } catch (error) {
    console.error('Error checking answer:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to check answer'
    })
  }
} 