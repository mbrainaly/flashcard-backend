import { Request, Response } from 'express';
import Blog from '../../models/Blog';
import BlogCategory from '../../models/BlogCategory';
import BlogTag from '../../models/BlogTag';
import { AuthenticatedRequest } from '../../middleware/admin.auth.middleware';

// Blog Management Controllers

export const getAllBlogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      status, 
      category, 
      tag, 
      author, 
      search, 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter: any = {};
    if (status) filter.status = status;
    if (category) filter.categories = category;
    if (tag) filter.tags = tag;
    if (author) filter['author.adminId'] = author;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
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
        .select('-content') // Exclude content for list view
        .lean(),
      Blog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: blogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blogs'
    });
  }
};

export const getBlogById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id)
      .populate('categories', 'name slug color description')
      .populate('tags', 'name slug color description')
      .populate('relatedPosts', 'title slug excerpt featuredImage')
      .lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    res.json({
      success: true,
      data: blog
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog post'
    });
  }
};

export const createBlog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const blogData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Set author information
    blogData.author = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
    };

    // Set metadata
    blogData.metadata = {
      lastEditedBy: {
        adminId: admin._id,
        name: admin.name,
        email: admin.email
      },
      revisionHistory: [{
        version: 1,
        editedBy: {
          adminId: admin._id,
          name: admin.name
        },
        changes: 'Initial creation',
        timestamp: new Date()
      }]
    };

    const blog = new Blog(blogData);
    await blog.save();

    // Update category and tag post counts
    if (blog.categories && blog.categories.length > 0) {
      await BlogCategory.updateMany(
        { _id: { $in: blog.categories } },
        { $inc: { postCount: 1 } }
      );
    }

    if (blog.tags && blog.tags.length > 0) {
      await BlogTag.updateMany(
        { _id: { $in: blog.tags } },
        { $inc: { postCount: 1 } }
      );
    }

    const populatedBlog = await Blog.findById(blog._id)
      .populate('categories', 'name slug color')
      .populate('tags', 'name slug color')
      .lean();

    res.status(201).json({
      success: true,
      data: populatedBlog,
      message: 'Blog post created successfully'
    });
  } catch (error) {
    console.error('Error creating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create blog post'
    });
  }
};

export const updateBlog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    const existingBlog = await Blog.findById(id);
    if (!existingBlog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    // Update metadata
    updateData.metadata = {
      ...existingBlog.metadata,
      lastEditedBy: {
        adminId: admin._id,
        name: admin.name,
        email: admin.email
      }
    };

    // Add revision history
    const currentVersion = existingBlog.metadata.revisionHistory?.length || 0;
    updateData.metadata.revisionHistory = [
      ...(existingBlog.metadata.revisionHistory || []),
      {
        version: currentVersion + 1,
        editedBy: {
          adminId: admin._id,
          name: admin.name
        },
        changes: updateData.revisionNote || 'Content updated',
        timestamp: new Date()
      }
    ];

    // Handle category changes
    const oldCategories = existingBlog.categories || [];
    const newCategories = updateData.categories || [];
    
    // Decrement count for removed categories
    const removedCategories = oldCategories.filter(
      cat => !newCategories.includes(cat.toString())
    );
    if (removedCategories.length > 0) {
      await BlogCategory.updateMany(
        { _id: { $in: removedCategories } },
        { $inc: { postCount: -1 } }
      );
    }

    // Increment count for added categories
    const addedCategories = newCategories.filter(
      cat => !oldCategories.map(c => c.toString()).includes(cat)
    );
    if (addedCategories.length > 0) {
      await BlogCategory.updateMany(
        { _id: { $in: addedCategories } },
        { $inc: { postCount: 1 } }
      );
    }

    // Handle tag changes
    const oldTags = existingBlog.tags || [];
    const newTags = updateData.tags || [];
    
    // Decrement count for removed tags
    const removedTags = oldTags.filter(
      tag => !newTags.includes(tag.toString())
    );
    if (removedTags.length > 0) {
      await BlogTag.updateMany(
        { _id: { $in: removedTags } },
        { $inc: { postCount: -1 } }
      );
    }

    // Increment count for added tags
    const addedTags = newTags.filter(
      tag => !oldTags.map(t => t.toString()).includes(tag)
    );
    if (addedTags.length > 0) {
      await BlogTag.updateMany(
        { _id: { $in: addedTags } },
        { $inc: { postCount: 1 } }
      );
    }

    const blog = await Blog.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('categories', 'name slug color')
      .populate('tags', 'name slug color')
      .lean();

    res.json({
      success: true,
      data: blog,
      message: 'Blog post updated successfully'
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update blog post'
    });
  }
};

export const deleteBlog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    // Decrement category and tag post counts
    if (blog.categories && blog.categories.length > 0) {
      await BlogCategory.updateMany(
        { _id: { $in: blog.categories } },
        { $inc: { postCount: -1 } }
      );
    }

    if (blog.tags && blog.tags.length > 0) {
      await BlogTag.updateMany(
        { _id: { $in: blog.tags } },
        { $inc: { postCount: -1 } }
      );
    }

    await Blog.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Blog post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete blog post'
    });
  }
};

export const publishBlog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByIdAndUpdate(
      id,
      { 
        status: 'published',
        publishedAt: new Date()
      },
      { new: true }
    )
      .populate('categories', 'name slug color')
      .populate('tags', 'name slug color')
      .lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    res.json({
      success: true,
      data: blog,
      message: 'Blog post published successfully'
    });
  } catch (error) {
    console.error('Error publishing blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish blog post'
    });
  }
};

export const unpublishBlog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByIdAndUpdate(
      id,
      { 
        status: 'draft',
        publishedAt: null
      },
      { new: true }
    )
      .populate('categories', 'name slug color')
      .populate('tags', 'name slug color')
      .lean();

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }

    res.json({
      success: true,
      data: blog,
      message: 'Blog post unpublished successfully'
    });
  } catch (error) {
    console.error('Error unpublishing blog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unpublish blog post'
    });
  }
};

// Category Management Controllers

export const getBlogCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, isActive, page = 1, limit = 50 } = req.query;

    // Build filter
    const filter: any = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [categories, total] = await Promise.all([
      BlogCategory.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('parentCategory', 'name slug')
        .lean(),
      BlogCategory.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: categories,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching blog categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog categories'
    });
  }
};

export const createCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categoryData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    categoryData.createdBy = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
    };

    categoryData.lastModifiedBy = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
    };

    const category = new BlogCategory(categoryData);
    await category.save();

    const populatedCategory = await BlogCategory.findById(category._id)
      .populate('parentCategory', 'name slug')
      .lean();

    res.status(201).json({
      success: true,
      data: populatedCategory,
      message: 'Blog category created successfully'
    });
  } catch (error) {
    console.error('Error creating blog category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create blog category'
    });
  }
};

export const updateCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    updateData.lastModifiedBy = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
    };

    const category = await BlogCategory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('parentCategory', 'name slug')
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Blog category not found'
      });
    }

    res.json({
      success: true,
      data: category,
      message: 'Blog category updated successfully'
    });
  } catch (error) {
    console.error('Error updating blog category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update blog category'
    });
  }
};

export const deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category has associated blog posts
    const postCount = await Blog.countDocuments({ categories: id });
    if (postCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${postCount} associated blog posts.`
      });
    }

    // Check if category has child categories
    const childCount = await BlogCategory.countDocuments({ parentCategory: id });
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${childCount} child categories.`
      });
    }

    const category = await BlogCategory.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Blog category not found'
      });
    }

    res.json({
      success: true,
      message: 'Blog category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete blog category'
    });
  }
};

// Tag Management Controllers

export const getBlogTags = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, isActive, page = 1, limit = 50 } = req.query;

    // Build filter
    const filter: any = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [tags, total] = await Promise.all([
      BlogTag.find(filter)
        .sort({ postCount: -1, name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      BlogTag.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: tags,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching blog tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog tags'
    });
  }
};

export const createTag = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tagData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    tagData.createdBy = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
    };

    tagData.lastModifiedBy = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
    };

    const tag = new BlogTag(tagData);
    await tag.save();

    res.status(201).json({
      success: true,
      data: tag,
      message: 'Blog tag created successfully'
    });
  } catch (error) {
    console.error('Error creating blog tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create blog tag'
    });
  }
};

export const updateTag = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    updateData.lastModifiedBy = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
    };

    const tag = await BlogTag.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Blog tag not found'
      });
    }

    res.json({
      success: true,
      data: tag,
      message: 'Blog tag updated successfully'
    });
  } catch (error) {
    console.error('Error updating blog tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update blog tag'
    });
  }
};

export const deleteTag = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if tag has associated blog posts
    const postCount = await Blog.countDocuments({ tags: id });
    if (postCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete tag. It has ${postCount} associated blog posts.`
      });
    }

    const tag = await BlogTag.findByIdAndDelete(id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Blog tag not found'
      });
    }

    res.json({
      success: true,
      message: 'Blog tag deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete blog tag'
    });
  }
};

// Analytics Controller

export const getBlogOverview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalPosts,
      publishedPosts,
      draftPosts,
      totalViews
    ] = await Promise.all([
      Blog.countDocuments(),
      Blog.countDocuments({ status: 'published' }),
      Blog.countDocuments({ status: 'draft' }),
      Blog.aggregate([{ $group: { _id: null, totalViews: { $sum: '$views' } } }])
    ]);

    res.json({
      success: true,
      data: {
        totalPosts,
        publishedPosts,
        draftPosts,
        totalViews: totalViews[0]?.totalViews || 0
      }
    });
  } catch (error) {
    console.error('Error fetching blog overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog overview'
    });
  }
};

export const getBlogAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, blogId } = req.query;

    // Basic blog statistics
    const [
      totalBlogs,
      publishedBlogs,
      draftBlogs,
      totalViews,
      totalCategories,
      totalTags
    ] = await Promise.all([
      Blog.countDocuments(),
      Blog.countDocuments({ status: 'published' }),
      Blog.countDocuments({ status: 'draft' }),
      Blog.aggregate([{ $group: { _id: null, totalViews: { $sum: '$views' } } }]),
      BlogCategory.countDocuments({ isActive: true }),
      BlogTag.countDocuments({ isActive: true })
    ]);

    // Top performing blogs
    const topBlogs = await Blog.find({ status: 'published' })
      .sort({ views: -1 })
      .limit(10)
      .select('title slug views likes publishedAt')
      .lean();

    // Most used categories
    const topCategories = await BlogCategory.find({ isActive: true })
      .sort({ postCount: -1 })
      .limit(10)
      .select('name postCount color')
      .lean();

    // Most used tags
    const topTags = await BlogTag.find({ isActive: true })
      .sort({ postCount: -1 })
      .limit(10)
      .select('name postCount color')
      .lean();

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await Blog.find({
      createdAt: { $gte: thirtyDaysAgo }
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('title status createdAt author.name')
      .lean();

    // Monthly blog creation stats
    const monthlyStats = await Blog.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          published: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const analytics = {
      overview: {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        totalViews: totalViews[0]?.totalViews || 0,
        totalCategories,
        totalTags
      },
      topPerforming: {
        blogs: topBlogs,
        categories: topCategories,
        tags: topTags
      },
      recentActivity,
      monthlyStats: monthlyStats.reverse()
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching blog analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog analytics'
    });
  }
};
