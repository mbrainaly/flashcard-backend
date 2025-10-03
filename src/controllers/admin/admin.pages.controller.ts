import { Request, Response } from 'express';
import Page from '../../models/Page';
import SEOSettings from '../../models/SEOSettings';
import ContactSubmission from '../../models/ContactSubmission';
import { AuthenticatedRequest } from '../../middleware/admin.auth.middleware';

// Page Management Controllers

export const getAllPages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, search, sortBy = 'lastModified', sortOrder = 'desc' } = req.query;

    // Build filter
    const filter: any = {};
    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pages = await Page.find(filter)
      .sort(sort)
      .select('-content') // Exclude content for list view
      .lean();

    res.json({
      success: true,
      data: pages,
      total: pages.length
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pages'
    });
  }
};

export const getPageById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const page = await Page.findOne({ slug }).lean();

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

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

export const updatePage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const updateData = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Add lastModifiedBy information
    updateData.lastModifiedBy = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email
    };
    updateData.lastModified = new Date();

    const page = await Page.findOneAndUpdate(
      { slug },
      updateData,
      { new: true, runValidators: true }
    );

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

    res.json({
      success: true,
      data: page,
      message: 'Page updated successfully'
    });
  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update page'
    });
  }
};

export const getPageAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { startDate, endDate } = req.query;

    const page = await Page.findOne({ slug }).select('views title slug').lean();

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

    // Mock analytics data - in a real app, you'd query your analytics service
    const analytics = {
      pageViews: page.views,
      uniqueVisitors: Math.floor(page.views * 0.7),
      bounceRate: Math.random() * 0.5 + 0.2, // 20-70%
      avgTimeOnPage: Math.floor(Math.random() * 300) + 60, // 1-5 minutes
      topReferrers: [
        { source: 'google.com', visits: Math.floor(page.views * 0.4) },
        { source: 'direct', visits: Math.floor(page.views * 0.3) },
        { source: 'social', visits: Math.floor(page.views * 0.2) },
        { source: 'other', visits: Math.floor(page.views * 0.1) }
      ],
      dailyViews: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        views: Math.floor(Math.random() * 50) + 10
      }))
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching page analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch page analytics'
    });
  }
};

export const updatePageSEO = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { seo } = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    const page = await Page.findOneAndUpdate(
      { slug },
      { 
        seo,
        lastModifiedBy: {
          adminId: admin._id,
          name: admin.name,
          email: admin.email
        },
        lastModified: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

    res.json({
      success: true,
      data: page.seo,
      message: 'Page SEO updated successfully'
    });
  } catch (error) {
    console.error('Error updating page SEO:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update page SEO'
    });
  }
};

// SEO Management Controllers

export const getGlobalSEO = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let seoSettings = await SEOSettings.findOne().lean();

    // If no settings exist, create default ones
    if (!seoSettings && req.admin) {
      const defaultSettings = new SEOSettings({
        siteName: 'FlashCard App',
        siteDescription: 'The ultimate flashcard application for effective learning',
        defaultTitle: 'FlashCard App - Smart Learning with Spaced Repetition',
        titleSeparator: ' | ',
        defaultKeywords: ['flashcards', 'learning', 'study', 'education'],
        canonicalUrl: 'https://flashcardapp.com',
        lastModifiedBy: {
          adminId: req.admin._id,
          name: req.admin.name,
          email: req.admin.email
        }
      });

      seoSettings = await defaultSettings.save();
    }

    res.json({
      success: true,
      data: seoSettings
    });
  } catch (error) {
    console.error('Error fetching global SEO settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global SEO settings'
    });
  }
};

export const updateGlobalSEO = async (req: AuthenticatedRequest, res: Response) => {
  try {
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

    let seoSettings = await SEOSettings.findOneAndUpdate(
      {},
      updateData,
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      data: seoSettings,
      message: 'Global SEO settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating global SEO settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update global SEO settings'
    });
  }
};

export const generateSitemap = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get all published pages
    const pages = await Page.find({ status: 'published' })
      .select('slug lastModified')
      .lean();

    // Generate XML sitemap
    const baseUrl = process.env.SITE_URL || 'https://flashcardapp.com';
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add homepage
    sitemap += `
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

    // Add pages
    pages.forEach(page => {
      sitemap += `
  <url>
    <loc>${baseUrl}/${page.slug}</loc>
    <lastmod>${page.lastModified.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    sitemap += `
</urlset>`;

    // Update SEO settings with sitemap URL
    await SEOSettings.findOneAndUpdate(
      {},
      { 
        sitemapUrl: `${baseUrl}/sitemap.xml`,
        lastModifiedBy: {
          adminId: req.admin!._id,
          name: req.admin!.name,
          email: req.admin!.email
        }
      },
      { upsert: true }
    );

    res.set('Content-Type', 'application/xml');
    res.json({
      success: true,
      data: {
        sitemap,
        url: `${baseUrl}/sitemap.xml`,
        pageCount: pages.length + 1
      },
      message: 'Sitemap generated successfully'
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sitemap'
    });
  }
};

export const updateRobotsTxt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { robotsTxt } = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    const seoSettings = await SEOSettings.findOneAndUpdate(
      {},
      { 
        robotsTxt,
        lastModifiedBy: {
          adminId: admin._id,
          name: admin.name,
          email: admin.email
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      data: { robotsTxt: seoSettings.robotsTxt },
      message: 'Robots.txt updated successfully'
    });
  } catch (error) {
    console.error('Error updating robots.txt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update robots.txt'
    });
  }
};

// Contact Management Controllers

export const getContactSubmissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      status, 
      priority, 
      assignedTo, 
      search, 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter['assignedTo.adminId'] = assignedTo;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [submissions, total] = await Promise.all([
      ContactSubmission.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('assignedTo.adminId', 'name email')
        .lean(),
      ContactSubmission.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: submissions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching contact submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact submissions'
    });
  }
};

export const updateContactSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { formSettings } = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Update contact page form settings
    const page = await Page.findOneAndUpdate(
      { slug },
      { 
        formSettings,
        lastModifiedBy: {
          adminId: admin._id,
          name: admin.name,
          email: admin.email
        },
        lastModified: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Contact page not found'
      });
    }

    res.json({
      success: true,
      data: page.formSettings,
      message: 'Contact settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating contact settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact settings'
    });
  }
};

// Contact Submission Management

export const getContactSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const submission = await ContactSubmission.findById(id)
      .populate('assignedTo.adminId', 'name email')
      .populate('replies.adminId', 'name email')
      .populate('notes.adminId', 'name email')
      .lean();

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      });
    }

    // Mark as read if it's new
    if (submission.status === 'new') {
      await ContactSubmission.findByIdAndUpdate(id, { status: 'read' });
    }

    res.json({
      success: true,
      data: submission
    });
  } catch (error) {
    console.error('Error fetching contact submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact submission'
    });
  }
};

export const updateContactSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const submission = await ContactSubmission.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      });
    }

    res.json({
      success: true,
      data: submission,
      message: 'Contact submission updated successfully'
    });
  } catch (error) {
    console.error('Error updating contact submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact submission'
    });
  }
};

export const replyToContactSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    const submission = await ContactSubmission.findByIdAndUpdate(
      id,
      {
        $push: {
          replies: {
            adminId: admin._id,
            adminName: admin.name,
            message,
            timestamp: new Date()
          }
        },
        status: 'replied'
      },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      });
    }

    // Here you would send the actual reply email to the user
    // await sendReplyEmail(submission.email, message);

    res.json({
      success: true,
      data: submission,
      message: 'Reply sent successfully'
    });
  } catch (error) {
    console.error('Error replying to contact submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply'
    });
  }
};

export const addNoteToContactSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    const submission = await ContactSubmission.findByIdAndUpdate(
      id,
      {
        $push: {
          notes: {
            adminId: admin._id,
            adminName: admin.name,
            note,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      });
    }

    res.json({
      success: true,
      data: submission,
      message: 'Note added successfully'
    });
  } catch (error) {
    console.error('Error adding note to contact submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note'
    });
  }
};
