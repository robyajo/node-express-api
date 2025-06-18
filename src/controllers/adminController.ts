import { Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

// Extend Express Request type
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
    }
  }
}

// Helper function to select user fields
const userSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  role: true,
  createdAt: true,
  updatedAt: true
} as const;

// Get all users (Admin only)
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: userSelect,
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
    res.status(500).json({ status: 'error', message: 'Error fetching users' });
  }
};

// Get user by ID (Admin only)
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect
    });

    if (!user) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Error fetching user' });
  }
};

// Create new user (Admin only)
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = 'USER' } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ status: 'error', message: 'Email already in use' });
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
        role: role || 'USER'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(201).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Error creating user' });
  }
};

// Update user (Admin only)
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);
    const { name, email, role } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }

    // Check if email is already in use by another user
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(400).json({ status: 'error', message: 'Email already in use' });
        return;
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || user.name,
        email: email || user.email,
        role: role || user.role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Error updating user' });
  }
};

// Delete user (Admin only)
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }

    // Delete user
    await prisma.user.delete({
      where: { id: userId }
    });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Error deleting user' });
  }
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
