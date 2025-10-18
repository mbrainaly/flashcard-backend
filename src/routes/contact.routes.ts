import express from 'express'
import { submitContactForm } from '../controllers/contact.controller'

const router = express.Router()

// Public route to submit contact form
router.post('/contact', submitContactForm)

export default router
