import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import process from 'process';

export interface JwtPayload {
  id: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export default (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || '') as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};