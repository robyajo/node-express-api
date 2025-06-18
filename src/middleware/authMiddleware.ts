import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

// The type declaration is already in auth.ts, so we don't need to redeclare it here
// We'll just import the necessary types and use them

interface JwtUserPayload {
  id: number;
  name: string | null;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export default (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || '') as JwtUserPayload;
    
    // Map the JWT payload to match our User type
    req.user = {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
      // These will be added by the database when we fetch the user
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};