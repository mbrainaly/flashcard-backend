import express from 'express'
import { getPublicFooter } from '../controllers/admin/admin.footer.controller'

const router = express.Router()

// Public route to get footer data
router.get('/footer', getPublicFooter)

export default router
