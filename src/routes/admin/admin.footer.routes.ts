import express from 'express'
import { getFooter, updateFooter } from '../../controllers/admin/admin.footer.controller'
import { protectAdmin } from '../../middleware/admin.auth.middleware'
import { requirePermissions } from '../../middleware/admin.permissions.middleware'

const router = express.Router()

// Admin routes (protected)
router.get('/footer', protectAdmin, requirePermissions(['pages.read']), getFooter)
router.put('/footer', protectAdmin, requirePermissions(['pages.write']), updateFooter)

export default router
