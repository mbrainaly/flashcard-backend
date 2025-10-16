import { Request, Response } from 'express';
import SystemSettings from '../../models/SystemSettings';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Get system settings
export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    let settings = await SystemSettings.findOne().populate('lastModifiedBy.adminId', 'name email');

    // If no settings exist, create default settings
    if (!settings) {
      const admin = req.admin;
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Admin not authenticated'
        });
      }

      settings = new SystemSettings({
        general: {
          siteName: 'FlashCard App',
          siteUrl: process.env.FRONTEND_URL || 'https://flashcardapp.com',
          adminEmail: admin.email,
          timezone: 'America/Los_Angeles',
          dateFormat: 'MM/DD/YYYY',
          language: 'en',
          maintenanceMode: false,
          registrationEnabled: true,
          emailVerificationRequired: true
        },
        lastModifiedBy: {
          adminId: admin._id,
          name: admin.name,
          email: admin.email
        }
      });

      await settings.save();
    }

    // Mask sensitive data
    const sanitizedSettings = {
      ...settings.toObject(),
      email: {
        ...settings.email,
        smtpPassword: settings.email.smtpPassword ? '••••••••' : ''
      },
      storage: {
        ...settings.storage,
        awsAccessKey: settings.storage.awsAccessKey ? 
          settings.storage.awsAccessKey.substring(0, 4) + '••••••••••••••••' : '',
        awsSecretKey: settings.storage.awsSecretKey ? '••••••••••••••••••••••••••••••••••••••••' : ''
      }
    };

    res.json({
      success: true,
      data: sanitizedSettings
    });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system settings'
    });
  }
};

// Update system settings
export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const admin = req.admin;
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    const updateData = {
      ...req.body,
      lastModified: new Date(),
      lastModifiedBy: {
        adminId: admin._id,
        name: admin.name,
        email: admin.email
      }
    };

    // Don't update sensitive fields if they contain masked values
    if (updateData.email?.smtpPassword === '••••••••') {
      delete updateData.email.smtpPassword;
    }
    if (updateData.storage?.awsSecretKey === '••••••••••••••••••••••••••••••••••••••••') {
      delete updateData.storage.awsSecretKey;
    }
    if (updateData.storage?.awsAccessKey?.includes('••••••••••••••••')) {
      delete updateData.storage.awsAccessKey;
    }

    let settings = await SystemSettings.findOne();
    
    if (!settings) {
      // Create new settings if none exist
      settings = new SystemSettings(updateData);
    } else {
      // Update existing settings
      Object.assign(settings, updateData);
    }

    await settings.save();

    // Mask sensitive data in response
    const sanitizedSettings = {
      ...settings.toObject(),
      email: {
        ...settings.email,
        smtpPassword: settings.email.smtpPassword ? '••••••••' : ''
      },
      storage: {
        ...settings.storage,
        awsAccessKey: settings.storage.awsAccessKey ? 
          settings.storage.awsAccessKey.substring(0, 4) + '••••••••••••••••' : '',
        awsSecretKey: settings.storage.awsSecretKey ? '••••••••••••••••••••••••••••••••••••••••' : ''
      }
    };

    res.json({
      success: true,
      data: sanitizedSettings,
      message: 'System settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update system settings'
    });
  }
};

// Reset system settings to defaults
export const resetSystemSettings = async (req: Request, res: Response) => {
  try {
    const admin = req.admin;
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not authenticated'
      });
    }

    // Delete existing settings
    await SystemSettings.deleteMany({});

    // Create new default settings
    const defaultSettings = new SystemSettings({
      general: {
        siteName: 'FlashCard App',
        siteUrl: process.env.FRONTEND_URL || 'https://flashcardapp.com',
        adminEmail: admin.email,
        timezone: 'America/Los_Angeles',
        dateFormat: 'MM/DD/YYYY',
        language: 'en',
        maintenanceMode: false,
        registrationEnabled: true,
        emailVerificationRequired: true
      },
      lastModifiedBy: {
        adminId: admin._id,
        name: admin.name,
        email: admin.email
      }
    });

    await defaultSettings.save();

    res.json({
      success: true,
      data: defaultSettings,
      message: 'System settings reset to defaults successfully'
    });
  } catch (error) {
    console.error('Error resetting system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset system settings'
    });
  }
};

// Get system status/health
export const getSystemStatus = async (req: Request, res: Response) => {
  try {
    const settings = await SystemSettings.findOne();
    
    const status = {
      maintenanceMode: settings?.general.maintenanceMode || false,
      registrationEnabled: settings?.general.registrationEnabled || true,
      emailVerificationRequired: settings?.general.emailVerificationRequired || true,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system status'
    });
  }
};

// Get public SEO settings (no authentication required)
export const getPublicSeoSettings = async (req: Request, res: Response) => {
  try {
    console.log('Public SEO settings requested');
    const settings = await SystemSettings.findOne();
    console.log('Settings found:', settings ? 'Yes' : 'No');
    
    if (settings) {
      console.log('Logo URL from DB:', settings.seo?.logoUrl);
    }
    
    if (!settings) {
      // Return default SEO settings if none exist
      console.log('No settings found, returning defaults');
      return res.json({
        success: true,
        data: {
          metaTitle: 'FlashCard App - Master Any Subject with AI-Powered Flashcards',
          metaDescription: 'Create, study, and master any subject with our AI-powered flashcard platform. Generate smart flashcards, take quizzes, and track your progress.',
          metaKeywords: 'flashcards, study, learning, AI, education, quiz, memory, spaced repetition',
          ogTitle: 'FlashCard App - AI-Powered Learning Platform',
          ogDescription: 'Transform your learning with AI-generated flashcards and intelligent study tools.',
          ogImage: '/images/og-image.jpg',
          twitterTitle: 'FlashCard App - Smart Learning Made Simple',
          twitterDescription: 'Create AI-powered flashcards and accelerate your learning journey.',
          twitterImage: '/images/twitter-image.jpg',
          favicon: '/favicon.ico',
          logoUrl: '/images/logo.png',
          siteName: 'FlashCard App'
        }
      });
    }

    const responseData = {
      ...settings.seo,
      siteName: settings.general.siteName
    };
    
    console.log('Returning SEO data:', responseData);

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching public SEO settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SEO settings'
    });
  }
};

// Upload logo or favicon (with S3 fallback to local storage)
export const uploadBrandingImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const { type } = req.body; // 'logo' or 'favicon'
    if (!type || !['logo', 'favicon'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image type. Must be "logo" or "favicon"'
      });
    }

    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `branding/${type}-${Date.now()}${fileExtension}`;

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    });

    await s3Client.send(uploadCommand);

    // Construct S3 URL
    const imageUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    // Update settings with new image URL
    let settings = await SystemSettings.findOne();
    if (!settings) {
      // Create default settings if none exist
      settings = new SystemSettings({
        lastModifiedBy: {
          adminId: (req as any).admin?._id,
          name: (req as any).admin?.name || 'System',
          email: (req as any).admin?.email || 'system@example.com'
        }
      });
    }

    // Update the appropriate field
    if (type === 'logo') {
      settings.seo.logoUrl = imageUrl;
    } else if (type === 'favicon') {
      settings.seo.favicon = imageUrl;
    }

    settings.lastModified = new Date();
    settings.lastModifiedBy = {
      adminId: (req as any).admin?._id,
      name: (req as any).admin?.name || 'System',
      email: (req as any).admin?.email || 'system@example.com'
    };

    await settings.save();

    res.json({
      success: true,
      data: {
        imageUrl,
        type,
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`
      }
    });
  } catch (error) {
    console.error('Error uploading branding image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image'
    });
  }
};

