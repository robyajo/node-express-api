import type { User as PrismaUser } from '@prisma/client';

export type { PrismaUser };

export interface User extends Omit<PrismaUser, 'password' | 'tokens'> {}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AuthRequest extends Request {
  user?: User;
  token?: string;
}
