import { Request, Response } from 'express';
import Page from '../models/Page';

export const getPageBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const page = await Page.findOne({ 
      slug, 
      status: 'published' 
    }).lean();

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

    // Increment view count
    await Page.findByIdAndUpdate(page._id, { $inc: { views: 1 } });

    res.json({
      success: true,
      data: page
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch page'
    });
  }
};
