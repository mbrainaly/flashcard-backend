import { Request, Response } from 'express'
import openaiClient from '../config/openai'
import { extractTextFromFile } from '../utils/fileProcessing'

// @desc    Get homework help
// @route   POST /api/ai/homework-help
// @access  Private
export const getHomeworkHelp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject, question } = req.body
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