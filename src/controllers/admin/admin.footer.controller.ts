import { Request, Response } from 'express'
import Footer from '../../models/Footer'

// Get footer data
export const getFooter = async (req: Request, res: Response) => {
  try {
    let footer = await Footer.findOne()
    
    // If no footer exists, create a default one
    if (!footer) {
      footer = new Footer({
        links: [
          { id: 'about', title: 'About Us', url: '/about', order: 0 },
          { id: 'features', title: 'Features', url: '/features', order: 1 },
          { id: 'pricing', title: 'Pricing', url: '/pricing', order: 2 },
          { id: 'contact', title: 'Contact Us', url: '/contact', order: 3 },
          { id: 'blog', title: 'Blog', url: '/blog', order: 4 }
        ],
        socialLinks: [
          { id: 'twitter', platform: 'Twitter', url: '', icon: 'twitter', order: 0 },
          { id: 'facebook', platform: 'Facebook', url: '', icon: 'facebook', order: 1 },
          { id: 'linkedin', platform: 'LinkedIn', url: '', icon: 'linkedin', order: 2 }
        ],
        bottomText: '© 2024 FlashCard App. All rights reserved.',
        lastModifiedBy: {
          adminId: req.admin._id,
          name: req.admin.name,
          email: req.admin.email
        }
      })
      
      await footer.save()
    }

    res.json({
      success: true,
      data: footer
    })
  } catch (error) {
    console.error('Error fetching footer:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch footer data'
    })
  }
}

// Update footer data
export const updateFooter = async (req: Request, res: Response) => {
  try {
    const {
      links,
      socialLinks,
      bottomText
    } = req.body

    let footer = await Footer.findOne()
    
    if (!footer) {
      // Create new footer if none exists
      footer = new Footer({
        links,
        socialLinks,
        bottomText,
        lastModifiedBy: {
          adminId: req.admin._id,
          name: req.admin.name,
          email: req.admin.email
        }
      })
    } else {
      // Update existing footer
      footer.links = links
      footer.socialLinks = socialLinks
      footer.bottomText = bottomText
      footer.lastModified = new Date()
      footer.lastModifiedBy = {
        adminId: req.admin._id,
        name: req.admin.name,
        email: req.admin.email
      }
    }

    await footer.save()

    res.json({
      success: true,
      data: footer,
      message: 'Footer updated successfully'
    })
  } catch (error) {
    console.error('Error updating footer:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update footer data'
    })
  }
}

// Get public footer data (no authentication required)
export const getPublicFooter = async (req: Request, res: Response) => {
  try {
    const footer = await Footer.findOne().select('-lastModifiedBy -createdAt -updatedAt')
    
    if (!footer) {
      return res.status(404).json({
        success: false,
        message: 'Footer data not found'
      })
    }

    res.json({
      success: true,
      data: footer
    })
  } catch (error) {
    console.error('Error fetching public footer:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch footer data'
    })
  }
}
