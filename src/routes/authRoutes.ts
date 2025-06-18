import { Router } from 'express';
import { 
  register, 
  login, 
  getCurrentUser, 
  logout, 
  getAllUsers, 
  getUserById 
} from '../controllers/authController';
import { auth } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/auth/register', register);
router.post('/auth/login', login);

// Protected routes
router.get('/auth/me', auth, getCurrentUser);
router.post('/auth/logout', auth, logout);

// Admin routes
router.get('/auth/users', auth, getAllUsers);
router.get('/auth/users/:id', auth, getUserById);

export default router;
