import { Router } from 'express';
import { body } from 'express-validator';
import { 
  createPost, 
  getAllPosts, 
  getPost, 
  updatePost, 
  deletePost,
  getCategories,
  getTags
} from '../controllers/postController';
import { uploadPostImage } from '../config/postMulter';
import { checkPostExists, checkPostOwnership } from '../middleware/postMiddleware';
import { auth } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getAllPosts);
router.get('/categories', getCategories);
router.get('/tags', getTags);
router.get('/:id', checkPostExists, getPost);

// Protected routes (require authentication)
router.use(auth);

// Create post (with image upload)
router.post(
  '/',
  uploadPostImage,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required'),
    body('categoryId').isInt().withMessage('Valid category ID is required'),
    body('status').optional().isIn(['draft', 'published']).withMessage('Invalid status'),
    body('excerpt').optional().isLength({ max: 500 }).withMessage('Excerpt must be less than 500 characters'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
  ],
  createPost
);

// Update post (with image upload)
router.put(
  '/:id',
  checkPostExists,
  checkPostOwnership,
  uploadPostImage,
  [
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
    body('categoryId').optional().isInt().withMessage('Valid category ID is required'),
    body('status').optional().isIn(['draft', 'published']).withMessage('Invalid status'),
    body('excerpt').optional().isLength({ max: 500 }).withMessage('Excerpt must be less than 500 characters'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
  ],
  updatePost
);

// Delete post
router.delete('/:id', checkPostExists, checkPostOwnership, deletePost);

export default router;
