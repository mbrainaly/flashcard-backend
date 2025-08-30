import { Request, Response } from 'express'
import openaiClient from '../config/openai'
import { extractTextFromFile } from '../utils/fileProcessing'
import User from '../models/User'
import { PLAN_RULES } from '../utils/plan'
import { deductCredits } from '../utils/credits'

// @desc    Get homework help
// @route   POST /api/ai/homework-help
// @access  Private
export const getHomeworkHelp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject, question } = req.body
    // Plan gating: AI study assistant must be allowed
    const user = await User.findById(req.user._id)
    const planId = (user?.subscription?.plan || 'basic') as 'basic' | 'pro' | 'team'
    const rules = PLAN_RULES[planId]
    if (!rules.allowAIStudyAssistant) {
      res.status(403).json({ success: false, message: 'Your plan does not include AI Study Assistant' })
      return
    }

    // Deduct 1 credit for AI assistant usage
    const charge = await deductCredits(req.user._id, 1)
    if (!charge.ok) {
      res.status(403).json({ success: false, message: 'Insufficient credits. Please upgrade your plan.' })
      return
    }
    let fileContent = ''

    if (!subject || !question) {
      res.status(400).json({
        success: false,
        message: 'Subject and question are required'
      })
      return
    }

    // Process uploaded file if present
    if (req.file) {
      try {
        fileContent = await extractTextFromFile(req.file)
      } catch (error) {
        console.error('Error processing file:', error)
        res.status(400).json({
          success: false,
          message: 'Failed to process uploaded file'
        })
        return
      }
    }

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert tutor helping students with their homework. You specialize in ${subject}.
          
Provide detailed, step-by-step solutions that:
1. Break down complex problems into manageable parts
2. Explain the reasoning behind each step
3. Include relevant formulas, theories, or concepts
4. Provide examples when helpful
5. Highlight key learning points
6. Suggest additional practice or resources

Format your response in clear HTML with:
- Main points in <h3> tags
- Steps in <ol> or <ul> tags
- Important concepts in <strong> tags
- Formulas in <code> tags
- Examples in <blockquote> tags
- References or resources in <aside> tags

Keep explanations clear and educational, encouraging understanding rather than just providing answers.`
        },
        {
          role: 'user',
          content: `Question: ${question}
${fileContent ? `\nAdditional Context:\n${fileContent}` : ''}`
        }
      ],
      temperature: 0.7,
    })

    const answer = response.choices[0].message.content || ''

    res.status(200).json({
      success: true,
      answer
    })
  } catch (error) {
    console.error('Error getting homework help:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get homework help'
    })
  }
} 