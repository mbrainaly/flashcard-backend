import { Express } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { PDFExtract } from 'pdf.js-extract'
import mammoth from 'mammoth'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const pdfExtract = new PDFExtract()

interface PDFPage {
  content: Array<{
    str: string;
    [key: string]: any;
  }>;
}

export const extractTextFromFile = async (file: Express.Multer.File): Promise<string> => {
  const extension = path.extname(file.originalname).toLowerCase()

  try {
    switch (extension) {
      case '.pdf':
        // Use a more type-safe approach with a temporary file
        const tempFilePath = path.join(__dirname, '../../uploads', `temp_${Date.now()}.pdf`)
        fs.writeFileSync(tempFilePath, file.buffer)
        
        try {
          const pdfData = await pdfExtract.extract(tempFilePath)
          const text = pdfData.pages
            .map(page => page.content.map((item: any) => item.str).join(' '))
            .join('\n')
          
          // Clean up temp file
          fs.unlinkSync(tempFilePath)
          return text
        } catch (err) {
          // Clean up temp file in case of error
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath)
          }
          throw err
        }

      case '.docx':
        const docxResult = await mammoth.extractRawText({ buffer: file.buffer })
        return docxResult.value

      case '.doc':
        // For .doc files, we'll return a message suggesting conversion to .docx
        return 'Note: For better results, please convert .doc files to .docx format.'

      case '.txt':
        return file.buffer.toString('utf-8')

      case '.jpg':
      case '.jpeg':
      case '.png':
        // For images, we'll return a message about manual input
        return 'Note: For images, please type out the relevant information in the question field.'

      default:
        throw new Error('Unsupported file type')
    }
  } catch (error) {
    console.error('Error extracting text from file:', error)
    throw new Error('Failed to process file')
  }
} 