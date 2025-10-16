import { Request, Response } from 'express';
import Blog from '../models/Blog';
import BlogCategory from '../models/BlogCategory';
import BlogTag from '../models/BlogTag';

// Public Blog Controllers

export const getPublishedBlogs = async (req: Request, res: Response) => {
  try {
    const { 
      category, 
      tag, 
      search, 
      page = 1, 
      limit = 12,
      sortBy = 'publishedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter - only published blogs
    const filter: any = { status: 'published' };
    
    if (category) {
      // Find category by slug
      const categoryDoc = await BlogCategory.findOne({ slug: category });
      if (categoryDoc) {
        filter.categories = categoryDoc._id;
      }
    }
    
    if (tag) {
      // Find tag by slug
      const tagDoc = await BlogTag.findOne({ slug: tag });
      if (tagDoc) {
        filter.tags = tagDoc._id;
      }
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('categories', 'name slug color')
        .populate('tags', 'name slug color')
        .select('title slug excerpt author publishedAt views likes readingTime featuredImage')
        .lean(),
      Blog.countDocuments(filter)
    ]);

    // Format the response to match frontend expectations
    const formattedBlogs = blogs.map(blog => ({
      _id: blog._id,
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt,
      author: {
        name: blog.author.name,
        role: 'Content Writer', // Default role for public display
        image: '/authors/default-avatar.jpg' // Default avatar
      },
      category: blog.categories?.[0] ? {
        title: (blog.categories[0] as any).name,
        slug: (blog.categories[0] as any).slug,
        href: `/blog/category/${(blog.categories[0] as any).slug}`
      } : {
        title: 'General',
        slug: 'general',
        href: '/blog/category/general'
      },
      publishedAt: blog.publishedAt,
      views: blog.views || 0,
      likes: blog.likes || 0,
      readingTime: blog.readingTime || 5,
      featuredImage: blog.featuredImage?.url || '/images/blog/default-featured.jpg'
    }));

    res.json({
      success: true,
      data: formattedBlogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching published blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog posts'
    });
  }
};

export const getBlogBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const blog = await Blog.findOne({ 
      slug, 
      status: 'published' 
    })
      .populate('categories', 'name slug color')
      .populate('tags', 'name slug color')
      .lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    // Increment view count
    await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });

    // Format the response
    const formattedBlog = {
      _id: blog._id,
      title: blog.title,
      slug: blog.slug,
      content: blog.content,
      excerpt: blog.excerpt,
      author: {
        name: blog.author.name,
        role: 'Content Writer',
        image: '/authors/default-avatar.jpg'
      },
      categories: blog.categories?.map((cat: any) => ({
        name: cat.name,
        slug: cat.slug,
        href: `/blog/category/${cat.slug}`
      })) || [],
      tags: blog.tags?.map((tag: any) => ({
        name: tag.name,
        slug: tag.slug,
        href: `/blog/tag/${tag.slug}`
      })) || [],
      publishedAt: blog.publishedAt,
      views: (blog.views || 0) + 1, // Include the incremented view
      likes: blog.likes || 0,
      readingTime: blog.readingTime || 5,
      featuredImage: blog.featuredImage?.url || '/images/blog/default-featured.jpg',
      seo: blog.seo
    };

    res.json({
      success: true,
      data: formattedBlog
    });
  } catch (error) {
    console.error('Error fetching blog by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog post'
    });
  }
};

export const getBlogCategories = async (req: Request, res: Response) => {
  try {
    const categories = await BlogCategory.find({ isActive: true })
      .select('name slug description color postCount')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching blog categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
};

export const getBlogTags = async (req: Request, res: Response) => {
  try {
    const tags = await BlogTag.find({ isActive: true })
      .select('name slug description color postCount')
      .sort({ postCount: -1 })
      .limit(20) // Limit to top 20 tags
      .lean();

    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    console.error('Error fetching blog tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tags'
    });
  }
};

