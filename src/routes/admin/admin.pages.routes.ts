import express from 'express';
import multer from 'multer';
import {
  getPagesOverview,
  getAllPages,
  getPageById,
  updatePage,
  getPageAnalytics,
  updatePageSEO,
  getGlobalSEO,
  updateGlobalSEO,
  generateSitemap,
  updateRobotsTxt,
  getContactSubmissions,
  updateContactSettings,
  getContactSubmission,
  updateContactSubmission,
  replyToContactSubmission,
  addNoteToContactSubmission,
  uploadPageImage
} from '../../controllers/admin/admin.pages.controller';
import { protectAdmin } from '../../middleware/admin.auth.middleware';
import { requirePermissions } from '../../middleware/admin.permissions.middleware';

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

const router = express.Router();

// Apply admin authentication to all routes
router.use(protectAdmin);

// Page Management Routes
router.get('/pages/overview', requirePermissions(['pages.read']), getPagesOverview);
router.get('/pages', requirePermissions(['pages.read']), getAllPages);
router.get('/pages/:slug', requirePermissions(['pages.read']), getPageById);
router.put('/pages/:slug', requirePermissions(['pages.write']), updatePage);
router.get('/pages/:slug/analytics', requirePermissions(['pages.read', 'analytics.read']), getPageAnalytics);
router.put('/pages/:slug/seo', requirePermissions(['pages.write']), updatePageSEO);
router.post('/pages/upload-image', requirePermissions(['pages.write']), upload.single('image'), uploadPageImage);

// SEO Management Routes
router.get('/seo/global', requirePermissions(['pages.read']), getGlobalSEO);
router.put('/seo/global', requirePermissions(['pages.write']), updateGlobalSEO);
router.post('/seo/sitemap/generate', requirePermissions(['pages.write']), generateSitemap);
router.put('/seo/robots', requirePermissions(['pages.write']), updateRobotsTxt);

// Contact Management Routes
router.get('/contact/submissions', requirePermissions(['contact.read']), getContactSubmissions);
router.get('/contact/submissions/:id', requirePermissions(['contact.read']), getContactSubmission);
router.put('/contact/submissions/:id', requirePermissions(['contact.write']), updateContactSubmission);
router.post('/contact/submissions/:id/reply', requirePermissions(['contact.write']), replyToContactSubmission);
router.post('/contact/submissions/:id/notes', requirePermissions(['contact.write']), addNoteToContactSubmission);
router.put('/contact/settings', requirePermissions(['pages.write']), updateContactSettings);

export default router;
