import express from 'express';
import {
  getSystemSettings,
  updateSystemSettings,
  resetSystemSettings,
  getSystemStatus,
  getPublicSeoSettings,
  uploadBrandingImage
} from '../../controllers/admin/admin.settings.controller';
import { protectAdmin } from '../../middleware/admin.auth.middleware';
import { requirePermissions } from '../../middleware/admin.permissions.middleware';
import multer from 'multer';

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Public routes (no authentication required)
router.get('/seo', getPublicSeoSettings);

// System Settings Routes (protected)
router.get('/settings', protectAdmin, requirePermissions(['system.read']), getSystemSettings);
router.put('/settings', protectAdmin, requirePermissions(['system.write']), updateSystemSettings);
router.post('/settings/reset', protectAdmin, requirePermissions(['system.write']), resetSystemSettings);
router.get('/settings/status', protectAdmin, requirePermissions(['system.read']), getSystemStatus);

// Branding Image Upload Route (protected)
router.post('/settings/upload-branding', protectAdmin, requirePermissions(['system.write']), upload.single('image'), uploadBrandingImage);

export default router;
