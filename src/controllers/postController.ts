import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { generateSlug } from '../utils/slugGenerator';

const prisma = new PrismaClient();

// Create a new post
export const createPost = async (req: Request, res: Response) => {
  try {
    const { title, content, excerpt, status, categoryId, tags } = req.body;
    const userId = (req as any).user.id;

    // Generate slug from title
    const slug = generateSlug(title);

    // Handle image upload
    let imagePath: string | undefined;
    if (req.file) {
      const fileExt = path.extname(req.file.originalname);
      const fileName = `post-${Date.now()}${fileExt}`;
      imagePath = `/uploads/posts/${fileName}`;
      
      // Save file to uploads directory
      const uploadDir = path.join(__dirname, '../../public/uploads/posts');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      fs.renameSync(req.file.path, path.join(uploadDir, fileName));
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || content.substring(0, 200) + '...',
        image: imagePath,
        status,
        authorId: userId,
        categoryId: parseInt(categoryId),
        publishedAt: status === 'published' ? new Date() : null,
      },
    });

    // Handle tags
    if (tags && tags.length > 0) {
      const tagIds = Array.isArray(tags) ? tags : [tags];
      
      // Create tags if they don't exist
      await Promise.all(
        tagIds.map(async (tagName: string) => {
          const slug = generateSlug(tagName);
          
          // Find or create tag
          let tag = await prisma.tag.findUnique({
            where: { slug },
          });

          if (!tag) {
            tag = await prisma.tag.create({
              data: {
                name: tagName,
                slug,
              },
            });
          }


          // Connect tag to post
          await prisma.postTag.create({
            data: {
              postId: post.id,
              tagId: tag.id,
            },
          });
        })
      );
    }


    // Get the full post with relations
    const fullPost = await prisma.post.findUnique({
      where: { id: post.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        category: true,
        postTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        post: fullPost,
      },
    });
  } catch (error: any) {
    console.error('Error creating post:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create post',
    });
  }
};

// Get all posts
export const getAllPosts = async (req: Request, res: Response) => {
  try {
    const { status, category, tag, search, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (status) where.status = status;
    if (category) where.category = { slug: category as string };
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { content: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (tag) {
      where.postTags = {
        some: {
          tag: {
            slug: tag as string,
          },
        },
      };
    }


    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          category: true,
          postTags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.post.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      results: posts.length,
      total,
      data: {
        posts,
      },
    });
  } catch (error: any) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch posts',
    });
  }
};

// Get a single post by ID or slug
export const getPost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isNumericId = /^\d+$/.test(id);
    
    const post = await prisma.post.findFirst({
      where: isNumericId ? { id: parseInt(id) } : { slug: id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        category: true,
        postTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found',
      });
    }

    // Increment view count
    await prisma.post.update({
      where: { id: post.id },
      data: { views: { increment: 1 } },
    });

    res.status(200).json({
      status: 'success',
      data: {
        post,
      },
    });
  } catch (error: any) {
    console.error('Error fetching post:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch post',
    });
  }
};

// Update a post
export const updatePost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, excerpt, status, categoryId, tags } = req.body;
    const userId = (req as any).user.id;

    // Check if post exists and user is the author or admin
    const existingPost = await prisma.post.findUnique({
      where: { id: parseInt(id) },
      include: { author: true },
    });

    if (!existingPost) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found',
      });
    }

    // Check if user is the author or admin
    const isAdmin = (req as any).user.role === 'ADMIN';
    const isAuthor = existingPost.authorId === userId;
    
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this post',
      });
    }

    // Generate new slug if title changed
    const slug = title && title !== existingPost.title 
      ? generateSlug(title)
      : existingPost.slug;

    // Handle image upload if new image is provided
    let imagePath = existingPost.image;
    if (req.file) {
      // Delete old image if exists
      if (existingPost.image) {
        const oldImagePath = path.join(__dirname, '../../public', existingPost.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Save new image
      const fileExt = path.extname(req.file.originalname);
      const fileName = `post-${Date.now()}${fileExt}`;
      imagePath = `/uploads/posts/${fileName}`;
      
      const uploadDir = path.join(__dirname, '../../public/uploads/posts');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      fs.renameSync(req.file.path, path.join(uploadDir, fileName));
    }

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id: parseInt(id) },
      data: {
        title: title || undefined,
        slug,
        content: content || undefined,
        excerpt: excerpt || undefined,
        image: imagePath,
        status: status || undefined,
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        publishedAt: status === 'published' && !existingPost.publishedAt 
          ? new Date() 
          : existingPost.publishedAt,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        category: true,
        postTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Handle tags if provided
    if (tags) {
      // Delete existing post tags
      await prisma.postTag.deleteMany({
        where: { postId: updatedPost.id },
      });

      // Add new tags
      const tagIds = Array.isArray(tags) ? tags : [tags];
      
      await Promise.all(
        tagIds.map(async (tagName: string) => {
          const slug = generateSlug(tagName);
          
          // Find or create tag
          let tag = await prisma.tag.findUnique({
            where: { slug },
          });

          if (!tag) {
            tag = await prisma.tag.create({
              data: {
                name: tagName,
                slug,
              },
            });
          }


          // Connect tag to post
          await prisma.postTag.create({
            data: {
              postId: updatedPost.id,
              tagId: tag.id,
            },
          });
        })
      );

      // Refetch the post with updated tags
      const postWithTags = await prisma.post.findUnique({
        where: { id: updatedPost.id },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          category: true,
          postTags: {
            include: {
              tag: true,
            },
          },
        },
      });

      return res.status(200).json({
        status: 'success',
        data: {
          post: postWithTags,
        },
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        post: updatedPost,
      },
    });
  } catch (error: any) {
    console.error('Error updating post:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update post',
    });
  }
};

// Delete a post
export const deletePost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    // Check if post exists
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
    const isAdmin = (req as any).user.role === 'ADMIN';
    const isAuthor = post.authorId === userId;
    
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this post',
      });
    }

    // Delete post image if exists
    if (post.image) {
      const imagePath = path.join(__dirname, '../../public', post.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete the post (PostTag will be deleted automatically due to onDelete: Cascade)
    await prisma.post.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error: any) {
    console.error('Error deleting post:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to delete post',
    });
  }
};

// Get all categories
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      results: categories.length,
      data: {
        categories,
      },
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch categories',
    });
  }
};

// Get all tags
export const getTags = async (req: Request, res: Response) => {
  try {
    const tags = await prisma.tag.findMany({
      include: {
        _count: {
          select: { postTags: true },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      results: tags.length,
      data: {
        tags,
      },
    });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch tags',
    });
  }
};
