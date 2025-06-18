import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { generateSlug } from '../utils/slugGenerator';

const prisma = new PrismaClient();

// Create a new category
export const createCategory = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;
    const slug = generateSlug(name);

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category' });
  }
};

// Get all categories
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

// Get single category by ID or slug
export const getCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isNumeric = /^\d+$/.test(id);
    
    const where = isNumeric 
      ? { id: parseInt(id) } 
      : { slug: id };

    const category = await prisma.category.findUnique({
      where,
      include: {
        posts: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            image: true,
            createdAt: true,
          },
          where: { status: 'published' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });


    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Error fetching category' });
  }
};

// Update a category
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description } = req.body;
    let updateData: any = { description };

    // Only update name and slug if name is provided
    if (name) {
      updateData.name = name;
      updateData.slug = generateSlug(name);
    }

    const category = await prisma.category.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category' });
  }
};

// Delete a category
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category has posts
    const categoryWithPosts = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { posts: true } } },
    });

    if (!categoryWithPosts) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (categoryWithPosts._count.posts > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with existing posts. Please reassign or delete the posts first.' 
      });
    }

    await prisma.category.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category' });
  }
};
