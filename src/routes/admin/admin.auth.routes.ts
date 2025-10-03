import express from 'express';
import {
  adminLogin,
  adminLogout,
  adminRefreshToken,
  adminProfile,
  updateAdminProfile,
  changeAdminPassword
} from '../../controllers/admin/admin.auth.controller';
import { 
  protectAdmin,
  adminLoginRateLimit
} from '../../middleware/admin.auth.middleware';
import { addPermissionHelpers } from '../../middleware/admin.permissions.middleware';

const router = express.Router();

// Public routes
router.post('/login', adminLoginRateLimit, adminLogin);
router.post('/refresh', adminRefreshToken);

// Protected routes (require authentication)
router.post('/logout', protectAdmin, adminLogout);
router.get('/profile', protectAdmin, addPermissionHelpers, adminProfile);
router.put('/profile', protectAdmin, addPermissionHelpers, updateAdminProfile);
router.put('/change-password', protectAdmin, addPermissionHelpers, changeAdminPassword);

export default router;
