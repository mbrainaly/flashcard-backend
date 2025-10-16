import express from 'express';
import multer from 'multer';
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
  getBlogOverview,
  getBlogAnalytics,
  uploadBlogImage
} from '../../controllers/admin/admin.blogs.controller';
import { protectAdmin } from '../../middleware/admin.auth.middleware';
import { requirePermissions } from '../../middleware/admin.permissions.middleware';

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Apply admin authentication to all routes
router.use(protectAdmin);

// Blog Management Routes - Specific routes must come before dynamic routes
router.get('/blogs', requirePermissions(['blogs.read']), getAllBlogs);
router.get('/blogs/overview', requirePermissions(['blogs.read']), getBlogOverview);
router.get('/blogs/analytics', requirePermissions(['blogs.read', 'analytics.read']), getBlogAnalytics);

// Image upload route
router.post('/blogs/upload-image', requirePermissions(['blogs.write']), upload.single('image'), uploadBlogImage);

// Category Management Routes - Must come before /blogs/:id
router.get('/blogs/categories', requirePermissions(['blogs.read']), getBlogCategories);
router.post('/blogs/categories', requirePermissions(['blogs.write']), createCategory);
router.put('/blogs/categories/:id', requirePermissions(['blogs.write']), updateCategory);
router.delete('/blogs/categories/:id', requirePermissions(['blogs.delete']), deleteCategory);

// Tag Management Routes - Must come before /blogs/:id
router.get('/blogs/tags', requirePermissions(['blogs.read']), getBlogTags);
router.post('/blogs/tags', requirePermissions(['blogs.write']), createTag);
router.put('/blogs/tags/:id', requirePermissions(['blogs.write']), updateTag);
router.delete('/blogs/tags/:id', requirePermissions(['blogs.delete']), deleteTag);

// Dynamic blog routes - Must come after specific routes
router.get('/blogs/:id', requirePermissions(['blogs.read']), getBlogById);
router.post('/blogs', requirePermissions(['blogs.write']), createBlog);
router.put('/blogs/:id', requirePermissions(['blogs.write']), updateBlog);
router.delete('/blogs/:id', requirePermissions(['blogs.delete']), deleteBlog);
router.post('/blogs/:id/publish', requirePermissions(['blogs.write']), publishBlog);
router.post('/blogs/:id/unpublish', requirePermissions(['blogs.write']), unpublishBlog);

export default router;
