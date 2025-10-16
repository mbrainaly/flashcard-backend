import express from 'express';
import {
  getPublishedBlogs,
  getBlogBySlug,
  getBlogCategories,
  getBlogTags
} from '../controllers/blog.controller';

const router = express.Router();

// Public blog routes
router.get('/', getPublishedBlogs);
router.get('/categories', getBlogCategories);
router.get('/tags', getBlogTags);
router.get('/:slug', getBlogBySlug);

export default router;

