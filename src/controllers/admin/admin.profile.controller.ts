import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import Admin from '../../models/Admin'
import ActivityLog from '../../models/ActivityLog'

// Get admin profile
export const getAdminProfile = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin?.id

    const admin = await Admin.findById(adminId).select('-password')
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      })
    }

    // Get recent activity logs
    const recentActivities = await ActivityLog.find({ adminId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action details ipAddress createdAt')

    const activityLog = recentActivities.map(activity => ({
      date: activity.createdAt,
      action: activity.action,
      details: activity.details,
      ipAddress: activity.ipAddress
    }))

    const profileData = {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      avatar: admin.avatar,
      location: admin.location,
      joinedAt: admin.createdAt,
      lastLogin: admin.lastLogin,
      permissions: admin.permissions,
      activityLog
    }

    res.json({
      success: true,
      data: profileData
    })
  } catch (error) {
    console.error('Error fetching admin profile:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

// Update admin profile
export const updateAdminProfile = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin?.id
    const { name, email, location } = req.body

    // Validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      })
    }

    // Check if email is already taken by another admin
    const existingAdmin = await Admin.findOne({ 
      email, 
      _id: { $ne: adminId } 
    })
    
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Email is already taken by another admin'
      })
    }

    // Update admin profile
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        location: location?.trim() || null
      },
      { new: true, runValidators: true }
    ).select('-password')

    if (!updatedAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      })
    }

    // Log the activity
    await ActivityLog.create({
      adminId,
      action: 'Updated Profile',
      details: 'Updated profile information',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    })

    // Get updated activity logs
    const recentActivities = await ActivityLog.find({ adminId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action details ipAddress createdAt')

    const activityLog = recentActivities.map(activity => ({
      date: activity.createdAt,
      action: activity.action,
      details: activity.details,
      ipAddress: activity.ipAddress
    }))

    const profileData = {
      _id: updatedAdmin._id,
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      role: updatedAdmin.role,
      avatar: updatedAdmin.avatar,
      location: updatedAdmin.location,
      joinedAt: updatedAdmin.createdAt,
      lastLogin: updatedAdmin.lastLogin,
      permissions: updatedAdmin.permissions,
      activityLog
    }

    res.json({
      success: true,
      data: profileData,
      message: 'Profile updated successfully'
    })
  } catch (error) {
    console.error('Error updating admin profile:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

// Change admin password
export const changeAdminPassword = async (req: Request, res: Response) => {
  try {
    const adminId = req.admin?.id
    const { currentPassword, newPassword } = req.body

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      })
    }

    // Get admin with password (explicitly select password field)
    const admin = await Admin.findById(adminId).select('+password')
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      })
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password)
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      })
    }

    // Hash new password
    const saltRounds = 12
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

    // Update password
    await Admin.findByIdAndUpdate(adminId, {
      password: hashedNewPassword
    })

    // Log the activity
    await ActivityLog.create({
      adminId,
      action: 'Changed Password',
      details: 'Successfully changed account password',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    })

    res.json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    console.error('Error changing admin password:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}
