import express from 'express'
import { evaluateAnswer, generateQuizQuestion } from '../controllers/study.controller'
import { protect } from '../middleware/auth'

const router = express.Router()

// Protected routes
router.use(protect)

router.post('/evaluate', evaluateAnswer)
router.post('/quiz/generate', generateQuizQuestion)

export default router 