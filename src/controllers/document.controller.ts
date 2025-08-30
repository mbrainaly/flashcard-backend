import { Request, Response } from 'express'
import User from '../models/User'
import { PLAN_RULES } from '../utils/plan'
import mammoth from 'mammoth'
import { PDFExtract, PDFExtractResult } from 'pdf.js-extract'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const readFile = promisify(fs.readFile)
const pdfExtract = new PDFExtract()

interface PDFPage {
  content: Array<{
    str: string
    [key: string]: any
  }>
}

export const analyzeDocument = async (req: Request, res: Response) => {
  try {
    // Plan gating: documents allowed only for Pro/Team
    const user = await User.findById(req.user._id)
    const planId = (user?.subscription?.plan || 'basic') as 'basic' | 'pro' | 'team'
    const rules = PLAN_RULES[planId]
    if (!rules.allowDocuments) {
      return res.status(403).json({ success: false, message: 'Your plan does not allow document uploading' })
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      })
    }

    const file = req.file
    const fileExtension = path.extname(file.originalname).toLowerCase()
    let content = ''

    switch (fileExtension) {
      case '.pdf':
        try {
          // Create a temporary file for the PDF
          const tempPath = path.join(__dirname, `../../temp-${Date.now()}.pdf`)
          fs.writeFileSync(tempPath, file.buffer)
          
          const pdfData = await pdfExtract.extract(tempPath) as PDFExtractResult
          content = pdfData.pages.map(page => 
            page.content.map(item => item.str).join(' ')
          ).join('\n')

          // Clean up the temporary file
          fs.unlinkSync(tempPath)
        } catch (pdfError) {
          console.error('Error extracting PDF content:', pdfError)
          return res.status(400).json({
            success: false,
            message: 'Failed to extract content from PDF. The file might be corrupted or password protected.'
          })
        }
        break

      case '.docx':
        try {
          const docxResult = await mammoth.extractRawText({ buffer: file.buffer })
          content = docxResult.value
        } catch (docxError) {
          console.error('Error extracting DOCX content:', docxError)
          return res.status(400).json({
            success: false,
            message: 'Failed to extract content from DOCX file. The file might be corrupted.'
          })
        }
        break

      case '.txt':
        content = file.buffer.toString('utf-8')
        break

      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported file format. Please upload a PDF, DOCX, or TXT file.'
        })
    }

    return res.status(200).json({
      success: true,
      content: content.trim()
    })

  } catch (error) {
    console.error('Error analyzing document:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze document'
    })
  }
} 