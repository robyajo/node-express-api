import { Request, Response } from 'express';
import prisma from '../config/database';
import { handleError } from '../utils/errorHandler';

export const getAllExamples = async (req: Request, res: Response) => {
  try {
    const examples = await prisma.example.findMany();
    res.status(200).json(examples);
  } catch (err) {
    handleError(res, 500, 'Error fetching examples');
  }
};

export const createExample = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const example = await prisma.example.create({
      data: { name, description }
    });
    res.status(201).json(example);
  } catch (err) {
    handleError(res, 500, 'Error creating example');
  }
};