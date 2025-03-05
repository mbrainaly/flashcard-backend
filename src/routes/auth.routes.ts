import express from 'express';
import { 
  register, 
  login, 
  getMe,
  updateProfile,
  changePassword
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.use(protect);
router.get('/me', getMe);
router.put('/update-profile', updateProfile);
router.put('/change-password', changePassword);

export default router; 