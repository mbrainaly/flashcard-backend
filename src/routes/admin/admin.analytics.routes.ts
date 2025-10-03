import express from 'express';
import {
  getDashboardStats,
  getUserAnalytics,
  getContentAnalytics,
  getRevenueAnalytics,
  getAIUsageAnalytics,
  getSystemPerformance,
  exportAnalytics
} from '../../controllers/admin/admin.analytics.controller';
import { protectAdmin } from '../../middleware/admin.auth.middleware';
import { requirePermissions } from '../../middleware/admin.permissions.middleware';

const router = express.Router();

// Apply admin authentication to all routes
router.use(protectAdmin);

// Analytics Routes
router.get('/analytics/dashboard', requirePermissions(['analytics.read']), getDashboardStats);
router.get('/analytics/users', requirePermissions(['analytics.read', 'users.read']), getUserAnalytics);
router.get('/analytics/content', requirePermissions(['analytics.read', 'content.read']), getContentAnalytics);
router.get('/analytics/revenue', requirePermissions(['analytics.read', 'subscriptions.read']), getRevenueAnalytics);
router.get('/analytics/ai-usage', requirePermissions(['analytics.read', 'system.read']), getAIUsageAnalytics);
router.get('/analytics/system', requirePermissions(['analytics.read', 'system.read']), getSystemPerformance);
router.post('/analytics/export', requirePermissions(['analytics.read', 'analytics.export']), exportAnalytics);

export default router;
