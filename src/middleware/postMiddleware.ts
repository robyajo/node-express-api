import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Middleware to check if user is the author of the post or admin
export const checkPostOwnership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const isAdmin = (req as any).user.role === 'ADMIN';

    const post = await prisma.post.findUnique({
      where: { id: parseInt(id) },
      include: { author: true },
    });

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found',
      });
    }

    // Check if user is the author or admin
    if (!isAdmin && post.authorId !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to perform this action',
      });
    }

    // Attach post to request for use in subsequent middleware/controller
    (req as any).post = post;
    next();
  } catch (error: any) {
    console.error('Error in checkPostOwnership:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};

// Middleware to check if post exists
export const checkPostExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const isNumericId = /^\d+$/.test(id);
    
    const post = await prisma.post.findFirst({
      where: isNumericId ? { id: parseInt(id) } : { slug: id },
    });

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found',
      });
    }

    // Attach post to request for use in subsequent middleware/controller
    (req as any).post = post;
    next();
  } catch (error: any) {
    console.error('Error in checkPostExists:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
};
