import express from 'express';
import {
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
  addNoteToContactSubmission
} from '../../controllers/admin/admin.pages.controller';
import { protectAdmin } from '../../middleware/admin.auth.middleware';
import { requirePermissions } from '../../middleware/admin.permissions.middleware';

const router = express.Router();

// Apply admin authentication to all routes
router.use(protectAdmin);

// Page Management Routes
router.get('/pages', requirePermissions(['pages.read']), getAllPages);
router.get('/pages/:slug', requirePermissions(['pages.read']), getPageById);
router.put('/pages/:slug', requirePermissions(['pages.write']), updatePage);
router.get('/pages/:slug/analytics', requirePermissions(['pages.read', 'analytics.read']), getPageAnalytics);
router.put('/pages/:slug/seo', requirePermissions(['pages.write']), updatePageSEO);

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
