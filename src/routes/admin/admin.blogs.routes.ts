import express from 'express';
import {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  publishBlog,
  unpublishBlog,
  getBlogCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getBlogTags,
  createTag,
  updateTag,
  deleteTag,
  getBlogAnalytics
} from '../../controllers/admin/admin.blogs.controller';
import { protectAdmin } from '../../middleware/admin.auth.middleware';
import { requirePermissions } from '../../middleware/admin.permissions.middleware';

const router = express.Router();

// Apply admin authentication to all routes
router.use(protectAdmin);

// Blog Management Routes
router.get('/blogs', requirePermissions(['blogs.read']), getAllBlogs);
router.get('/blogs/analytics', requirePermissions(['blogs.read', 'analytics.read']), getBlogAnalytics);
router.get('/blogs/:id', requirePermissions(['blogs.read']), getBlogById);
router.post('/blogs', requirePermissions(['blogs.write']), createBlog);
router.put('/blogs/:id', requirePermissions(['blogs.write']), updateBlog);
router.delete('/blogs/:id', requirePermissions(['blogs.delete']), deleteBlog);
router.post('/blogs/:id/publish', requirePermissions(['blogs.write']), publishBlog);
router.post('/blogs/:id/unpublish', requirePermissions(['blogs.write']), unpublishBlog);

// Category Management Routes
router.get('/blogs/categories', requirePermissions(['blogs.read']), getBlogCategories);
router.post('/blogs/categories', requirePermissions(['blogs.write']), createCategory);
router.put('/blogs/categories/:id', requirePermissions(['blogs.write']), updateCategory);
router.delete('/blogs/categories/:id', requirePermissions(['blogs.delete']), deleteCategory);

// Tag Management Routes
router.get('/blogs/tags', requirePermissions(['blogs.read']), getBlogTags);
router.post('/blogs/tags', requirePermissions(['blogs.write']), createTag);
router.put('/blogs/tags/:id', requirePermissions(['blogs.write']), updateTag);
router.delete('/blogs/tags/:id', requirePermissions(['blogs.delete']), deleteTag);

export default router;
