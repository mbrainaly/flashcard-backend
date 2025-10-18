import express from 'express'
import { 
  getAdminProfile, 
  updateAdminProfile, 
  changeAdminPassword 
} from '../../controllers/admin/admin.profile.controller'
import { protectAdmin } from '../../middleware/admin.auth.middleware'

const router = express.Router()

// All routes require admin authentication
router.use(protectAdmin)

// @route   GET /api/admin/profile
// @desc    Get admin profile
// @access  Private (Admin)
router.get('/', getAdminProfile)

// @route   PUT /api/admin/profile
// @desc    Update admin profile
// @access  Private (Admin)
router.put('/', updateAdminProfile)

// @route   PUT /api/admin/profile/password
// @desc    Change admin password
// @access  Private (Admin)
router.put('/password', changeAdminPassword)

export default router
