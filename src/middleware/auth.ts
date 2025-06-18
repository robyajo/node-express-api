import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Extend the Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        name: string | null;
        email: string;
        role: UserRole;
        createdAt: Date;
        updatedAt: Date;
      };
      token?: string;
    }
  }
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ status: 'error', message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };

    // Check if token is valid in database
    const tokenRecord = await prisma.token.findFirst({
      where: {
        token,
        userId: decoded.id,
        isRevoked: false,
        expiresAt: {
          gte: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!tokenRecord) {
      return res.status(401).json({ status: 'error', message: 'Token is not valid or has expired' });
    }

    // Add user and token to request object
    const { password, ...userWithoutPassword } = tokenRecord.user;
    req.user = userWithoutPassword as any;
    req.token = token;

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ status: 'error', message: 'Invalid token' });
    } else if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ status: 'error', message: 'Token expired' });
    }
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Access denied. Admin only.' 
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};
