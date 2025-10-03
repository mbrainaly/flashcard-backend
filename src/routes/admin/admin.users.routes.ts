import express from 'express';
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserActivity,
  getUserSubscription,
  updateUserSubscription,
  getUserStats
} from '../../controllers/admin/admin.users.controller';
import { protectAdmin } from '../../middleware/admin.auth.middleware';
import { requirePermissions } from '../../middleware/admin.permissions.middleware';

const router = express.Router();

// Apply admin authentication to all routes
router.use(protectAdmin);

// User Management Routes
router.post('/users', requirePermissions(['users.write']), createUser);
router.get('/users', requirePermissions(['users.read']), getAllUsers);
router.get('/users/:id', requirePermissions(['users.read']), getUserById);
router.put('/users/:id', requirePermissions(['users.write']), updateUser);
router.delete('/users/:id', requirePermissions(['users.delete']), deleteUser);

// User Activity Routes
router.get('/users/:id/activity', requirePermissions(['users.read']), getUserActivity);

// User Subscription Routes
router.get('/users/:id/subscription', requirePermissions(['users.read', 'subscriptions.read']), getUserSubscription);
router.put('/users/:id/subscription', requirePermissions(['users.write', 'subscriptions.write']), updateUserSubscription);

// User Statistics Route
router.get('/users/:id/stats', requirePermissions(['users.read', 'analytics.read']), getUserStats);

export default router;
