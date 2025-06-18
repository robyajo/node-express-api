import { Router } from 'express';
import { 
  getAllUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser 
} from '../controllers/adminController';
import { auth, adminOnly } from '../middleware/auth';
import { uploadAvatar } from '../config/multer';

const router = Router();

// Apply auth and admin middleware to all routes
router.use(auth);
router.use(adminOnly);

// Admin routes
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.post('/users', uploadAvatar, createUser);
router.put('/users/:id', uploadAvatar, updateUser);
router.delete('/users/:id', deleteUser);

export default router;
