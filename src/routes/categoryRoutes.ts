import { Router } from 'express';
import { body } from 'express-validator';
import { 
  createCategory, 
  getAllCategories, 
  getCategory, 
  updateCategory, 
  deleteCategory 
} from '../controllers/categoryController';
import { auth } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getAllCategories);
router.get('/:id', getCategory);

// Protected routes (require authentication)
router.post(
  '/',
  [
    auth,
    body('name').trim().notEmpty().withMessage('Name is required')
      .isLength({ max: 100 }).withMessage('Name must be less than 100 characters'),
    body('description').optional().isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
  ],
  createCategory
);

router.put(
  '/:id',
  [
    auth,
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty')
      .isLength({ max: 100 }).withMessage('Name must be less than 100 characters'),
    body('description').optional().isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
  ],
  updateCategory
);

router.delete('/:id', auth, deleteCategory);

export default router;
