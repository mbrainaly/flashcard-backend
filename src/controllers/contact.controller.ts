import { Request, Response } from 'express'
import ContactSubmission from '../models/ContactSubmission'

// Simple validation helper
const validateContactForm = (data: any) => {
  const errors: string[] = []
  
  if (!data.firstName || typeof data.firstName !== 'string' || data.firstName.trim().length === 0 || data.firstName.trim().length > 100) {
    errors.push('First name is required and must be less than 100 characters')
  }
  
  if (!data.lastName || typeof data.lastName !== 'string' || data.lastName.trim().length === 0 || data.lastName.trim().length > 100) {
    errors.push('Last name is required and must be less than 100 characters')
  }
  
  if (!data.email || typeof data.email !== 'string' || !data.email.includes('@') || data.email.trim().length === 0) {
    errors.push('Valid email is required')
  }
  
  if (data.phone && (typeof data.phone !== 'string' || data.phone.trim().length > 20)) {
    errors.push('Phone number must be less than 20 characters')
  }
  
  if (!data.message || typeof data.message !== 'string' || data.message.trim().length < 10 || data.message.trim().length > 5000) {
    errors.push('Message is required and must be between 10 and 5000 characters')
  }
  
  return errors
}

// Submit contact form (public endpoint)
export const submitContactForm = async (req: Request, res: Response) => {
  try {
    // Validate form data
    const validationErrors = validateContactForm(req.body)
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      })
    }

    const { firstName, lastName, email, phone, message } = req.body

    // Get client IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress
    const userAgent = req.get('User-Agent')

    // Create new contact submission
    const contactSubmission = new ContactSubmission({
      firstName,
      lastName,
      email,
      phone,
      message,
      source: 'contact_page',
      ipAddress,
      userAgent
    })

    await contactSubmission.save()

    res.status(201).json({
      success: true,
      message: 'Contact form submitted successfully. We will get back to you soon!',
      data: {
        id: contactSubmission._id,
        submittedAt: contactSubmission.submittedAt
      }
    })
  } catch (error) {
    console.error('Contact form submission error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form. Please try again later.'
    })
  }
}
