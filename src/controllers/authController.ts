import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, User as PrismaUser } from '@prisma/client';
import { RegisterInput, LoginInput, User, AuthRequest } from '../types/auth';
import { handleError } from '../utils/errorHandler';
import { logError, logInfo } from '../utils/logger';

declare global {
  namespace Express {
    interface Request extends AuthRequest {}
  }
}

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// JWT token expiration time (7 days by default)
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateAuthToken = async (userId: number): Promise<string> => {
  try {
    // Create payload with user ID
    const payload = { id: userId };
    
    // Generate JWT token
    const token = await new Promise<string>((resolve, reject) => {
      jwt.sign(
        payload,
        JWT_SECRET,
        {
          expiresIn: '7d', // Fixed value for simplicity
          algorithm: 'HS256'
        },
        (err, token) => {
          if (err) return reject(err);
          if (!token) return reject(new Error('Failed to generate token'));
          resolve(token);
        }
      );
    });
    
    // Save token to database
    await prisma.token.create({
      data: {
        token,
        type: 'auth',
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return token;
  } catch (error) {
    console.error('Error generating auth token:', error);
    throw new Error('Failed to generate authentication token');
  }
};

const toUser = (user: PrismaUser): User => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword as User;
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password }: RegisterInput = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      handleError(res, 400, 'Email already in use');
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Generate token
    const token = await generateAuthToken(user.id);

    logInfo('User registered successfully', {
      context: 'auth.registration',
      userId: user.id,
      email: user.email
    });

    res.status(201).json({
      user: toUser(user),
      token,
    });
  } catch (err) {
    logError('Registration failed', err, {
      context: 'auth.registration',
      request: {
        method: req.method,
        url: req.originalUrl,
        body: { ...req.body, password: '[HIDDEN]' },
        headers: req.headers
      }
    });
    handleError(res, 500, 'Error registering user');
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginInput = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      handleError(res, 401, 'Invalid credentials');
      return;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      handleError(res, 401, 'Invalid credentials');
      return;
    }

    // Generate token
    const token = await generateAuthToken(user.id);

    logInfo('User logged in successfully', {
      context: 'auth.login',
      userId: user.id,
      email: user.email
    });

    res.status(200).json({
      user: toUser(user),
      token,
    });
  } catch (err) {
    logError('Login failed', err, {
      context: 'auth.login',
      request: {
        method: req.method,
        url: req.originalUrl,
        body: { ...req.body, password: '[HIDDEN]' },
        headers: req.headers
      },
      user: { email: req.body?.email || 'unknown' }
    });
    handleError(res, 500, 'Error logging in');
  }
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as PrismaUser;
    if (!user) {
      handleError(res, 401, 'Not authenticated');
      return;
    }

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    
    res.status(200).json(userWithoutPassword);
  } catch (err) {
    handleError(res, 500, 'Error fetching user');
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.token;
    
    // Revoke the token
    await prisma.token.updateMany({
      where: { token: token || '', isRevoked: false },
      data: { isRevoked: true },
    });

    logInfo('User logged out successfully', {
      context: 'auth.logout',
      userId: (req.user as PrismaUser)?.id,
      token: token ? '***' : 'missing'
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    logError('Logout failed', err, {
      context: 'auth.logout',
      token: req.token ? '***' : 'missing',
      user: req.user ? { id: (req.user as PrismaUser).id } : 'unauthenticated'
    });
    handleError(res, 500, 'Error logging out');
  }
};

// Get all users (Admin only)
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: {
        users
      }
    });
  } catch (err) {
    handleError(res, 500, 'Error fetching users');
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      handleError(res, 404, 'User not found');
      return;
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    handleError(res, 500, 'Error fetching user');
  }
};
