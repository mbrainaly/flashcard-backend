import express from 'express';
import { getPageBySlug } from '../controllers/pages.controller';

const router = express.Router();

// Public page routes (no authentication required)
router.get('/:slug', getPageBySlug);

export default router;
