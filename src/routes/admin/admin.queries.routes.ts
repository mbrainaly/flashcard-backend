import express from 'express'
import { protectAdmin } from '../../middleware/admin.auth.middleware'
import { requirePermissions } from '../../middleware/admin.permissions.middleware'
import {
  getContactSubmissions,
  getContactSubmission,
  updateContactSubmission,
  deleteContactSubmission,
  bulkUpdateSubmissions
} from '../../controllers/admin/admin.queries.controller'

const router = express.Router()

// Apply admin authentication to all routes
router.use(protectAdmin)

// Get all contact submissions (with pagination and filtering)
router.get('/', requirePermissions(['queries.read']), getContactSubmissions)

// Get single contact submission
router.get('/:id', requirePermissions(['queries.read']), getContactSubmission)

// Update contact submission
router.put('/:id', requirePermissions(['queries.update']), updateContactSubmission)

// Delete contact submission
router.delete('/:id', requirePermissions(['queries.delete']), deleteContactSubmission)

// Bulk update submissions
router.post('/bulk-update', requirePermissions(['queries.update']), bulkUpdateSubmissions)

export default router
