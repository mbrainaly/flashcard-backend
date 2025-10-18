import { Request, Response } from 'express'
import ContactSubmission from '../../models/ContactSubmission'
import { AuthenticatedRequest } from '../../middleware/admin.auth.middleware'

// Get all contact submissions with pagination and filtering
export const getContactSubmissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('Getting contact submissions for admin:', req.admin?.email)
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 25
    const status = req.query.status as string
    const search = req.query.search as string
    const sortBy = req.query.sortBy as string || 'submittedAt'
    const sortOrder = req.query.sortOrder as string || 'desc'

    // Build filter object
    const filter: any = {}
    
    if (status && status !== 'all') {
      filter.status = status
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ]
    }

    // Build sort object
    const sort: any = {}
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1

    // Get submissions with pagination
    const submissions = await ContactSubmission.find(filter)
      .sort(sort)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean()

    // Get total count for pagination
    const totalSubmissions = await ContactSubmission.countDocuments(filter)
    const totalPages = Math.ceil(totalSubmissions / limit)

    // Get status counts for dashboard
    const statusCounts = await ContactSubmission.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])

    const statusStats = {
      new: 0,
      read: 0,
      replied: 0,
      resolved: 0,
      total: totalSubmissions
    }

    statusCounts.forEach(item => {
      statusStats[item._id as keyof typeof statusStats] = item.count
    })

    res.json({
      success: true,
      data: {
        submissions,
        pagination: {
          currentPage: page,
          totalPages,
          totalSubmissions,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        statusStats
      }
    })
  } catch (error) {
    console.error('Error fetching contact submissions:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact submissions'
    })
  }
}

// Get single contact submission
export const getContactSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params

    const submission = await ContactSubmission.findById(id)
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      })
    }

    // Mark as read if it's new
    if (submission.status === 'new') {
      submission.status = 'read'
      submission.readAt = new Date()
      await submission.save()
    }

    res.json({
      success: true,
      data: submission
    })
  } catch (error) {
    console.error('Error fetching contact submission:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact submission'
    })
  }
}

// Update contact submission status
export const updateContactSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { status, adminNotes, assignedTo } = req.body

    const submission = await ContactSubmission.findById(id)
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      })
    }

    // Update status and timestamps
    if (status && status !== submission.status) {
      submission.status = status
      
      if (status === 'read' && !submission.readAt) {
        submission.readAt = new Date()
      } else if (status === 'replied' && !submission.repliedAt) {
        submission.repliedAt = new Date()
      } else if (status === 'resolved' && !submission.resolvedAt) {
        submission.resolvedAt = new Date()
      }
    }

    // Update admin notes
    if (adminNotes !== undefined) {
      submission.adminNotes = adminNotes
    }

    // Update assigned admin
    if (assignedTo !== undefined) {
      if (assignedTo) {
        submission.assignedTo = {
          adminId: assignedTo.adminId,
          name: assignedTo.name,
          email: assignedTo.email
        }
      } else {
        submission.assignedTo = undefined
      }
    }

    await submission.save()

    res.json({
      success: true,
      message: 'Contact submission updated successfully',
      data: submission
    })
  } catch (error) {
    console.error('Error updating contact submission:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update contact submission'
    })
  }
}

// Delete contact submission
export const deleteContactSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params

    const submission = await ContactSubmission.findById(id)
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      })
    }

    await ContactSubmission.findByIdAndDelete(id)

    res.json({
      success: true,
      message: 'Contact submission deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting contact submission:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact submission'
    })
  }
}

// Bulk update contact submissions
export const bulkUpdateSubmissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids, action, status, assignedTo } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No submission IDs provided'
      })
    }

    const updateData: any = {}
    
    if (action === 'updateStatus' && status) {
      updateData.status = status
      
      if (status === 'read') {
        updateData.readAt = new Date()
      } else if (status === 'replied') {
        updateData.repliedAt = new Date()
      } else if (status === 'resolved') {
        updateData.resolvedAt = new Date()
      }
    }

    if (action === 'assign' && assignedTo) {
      updateData.assignedTo = assignedTo
    }

    if (action === 'unassign') {
      updateData.$unset = { assignedTo: 1 }
    }

    const result = await ContactSubmission.updateMany(
      { _id: { $in: ids } },
      updateData
    )

    res.json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} submissions`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    })
  } catch (error) {
    console.error('Error bulk updating submissions:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update submissions'
    })
  }
}
