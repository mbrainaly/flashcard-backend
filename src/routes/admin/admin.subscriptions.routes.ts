import express from 'express';
import {
  getAllSubscriptions,
  getSubscriptionById,
  updateSubscription,
  cancelSubscription,
  getAllPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getBillingOverview,
  processRefund
} from '../../controllers/admin/admin.subscriptions.controller';
import { protectAdmin } from '../../middleware/admin.auth.middleware';
import { requirePermissions } from '../../middleware/admin.permissions.middleware';

const router = express.Router();

// Apply admin authentication to all routes
router.use(protectAdmin);

// Subscription Management Routes
router.get('/subscriptions', requirePermissions(['subscriptions.read']), getAllSubscriptions);
router.get('/subscriptions/:id', requirePermissions(['subscriptions.read']), getSubscriptionById);
router.put('/subscriptions/:id', requirePermissions(['subscriptions.write']), updateSubscription);
router.delete('/subscriptions/:id', requirePermissions(['subscriptions.write']), cancelSubscription);

// Plan Management Routes
router.get('/plans', requirePermissions(['subscriptions.read']), getAllPlans);
router.post('/plans', requirePermissions(['subscriptions.write']), createPlan);
router.put('/plans/:id', requirePermissions(['subscriptions.write']), updatePlan);
router.delete('/plans/:id', requirePermissions(['subscriptions.delete']), deletePlan);

// Billing Management Routes
router.get('/billing/overview', requirePermissions(['subscriptions.read', 'analytics.read']), getBillingOverview);
router.post('/billing/refund', requirePermissions(['subscriptions.write', 'billing.refund']), processRefund);

export default router;
