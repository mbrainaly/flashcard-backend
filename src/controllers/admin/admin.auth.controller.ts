import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Admin from '../../models/Admin';
import AdminSession from '../../models/AdminSession';

// Extend Request interface to include admin
declare global {
  namespace Express {
    interface Request {
      admin?: any;
    }
  }
}

interface AdminLoginRequest extends Request {
  body: {
    email: string;
    password: string;
    rememberMe?: boolean;
  };
}

interface AdminRefreshRequest extends Request {
  body: {
    refreshToken: string;
  };
}

// Generate JWT tokens
const generateTokens = (adminId: string) => {
  const accessToken = jwt.sign(
    { adminId, type: 'admin' },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' } // Short-lived access token
  );

  const refreshToken = jwt.sign(
    { adminId, type: 'admin_refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' } // Longer-lived refresh token
  );

  return { accessToken, refreshToken };
};

// @desc    Admin login
// @route   POST /api/admin/auth/login
// @access  Public
export const adminLogin = async (req: AdminLoginRequest, res: Response): Promise<void> => {
  try {
    const { email, password, rememberMe = false } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    // Find admin by email and include password for comparison
    const admin = await Admin.findOne({ email }).select('+password');
    
    if (!admin) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    // Check if account is locked
    if (admin.isLocked) {
      res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed login attempts'
      });
      return;
    }

    // Check if account is active
    if (!admin.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
      return;
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);
    
    if (!isPasswordValid) {
      // Increment login attempts
      await admin.incLoginAttempts();
      
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    // Reset login attempts on successful login
    await admin.resetLoginAttempts();

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(admin._id.toString());

    // Create session
    const sessionExpiry = rememberMe ? 
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : // 30 days
      new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await AdminSession.create({
      adminId: admin._id,
      token: accessToken,
      refreshToken,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      isActive: true,
      expiresAt: sessionExpiry,
      refreshExpiresAt: refreshExpiry,
      lastActivity: new Date()
    });

    // Remove password from response
    const adminResponse = admin.toObject();
    delete (adminResponse as any).password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        admin: adminResponse,
        accessToken,
        refreshToken,
        expiresIn: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60 // seconds
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Admin logout
// @route   POST /api/admin/auth/logout
// @access  Private (Admin)
export const adminLogout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      // Deactivate the session
      await AdminSession.updateOne(
        { token, isActive: true },
        { $set: { isActive: false } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Refresh admin token
// @route   POST /api/admin/auth/refresh
// @access  Public
export const adminRefreshToken = async (req: AdminRefreshRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
      return;
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
      return;
    }

    // Find active session with this refresh token
    const session = await AdminSession.findOne({
      refreshToken,
      isActive: true,
      refreshExpiresAt: { $gt: new Date() }
    });

    if (!session) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
      return;
    }

    // Find admin
    const admin = await Admin.findById(decoded.adminId);
    
    if (!admin || !admin.isActive) {
      res.status(401).json({
        success: false,
        message: 'Admin not found or inactive'
      });
      return;
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(admin._id.toString());

    // Update session with new tokens
    session.token = accessToken;
    session.refreshToken = newRefreshToken;
    session.expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    session.lastActivity = new Date();
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      }
    });

  } catch (error) {
    console.error('Admin token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get admin profile
// @route   GET /api/admin/auth/profile
// @access  Private (Admin)
export const adminProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = await Admin.findById(req.admin._id);
    
    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        admin
      }
    });

  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Update admin profile
// @route   PUT /api/admin/auth/profile
// @access  Private (Admin)
export const updateAdminProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email } = req.body;
    
    const admin = await Admin.findById(req.admin._id);
    
    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
      return;
    }

    // Update fields if provided
    if (name) admin.name = name;
    if (email && email !== admin.email) {
      // Check if email already exists
      const existingAdmin = await Admin.findOne({ email, _id: { $ne: admin._id } });
      if (existingAdmin) {
        res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
        return;
      }
      admin.email = email;
    }

    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        admin
      }
    });

  } catch (error) {
    console.error('Update admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Change admin password
// @route   PUT /api/admin/auth/change-password
// @access  Private (Admin)
export const changeAdminPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
      return;
    }

    const admin = await Admin.findById(req.admin._id).select('+password');
    
    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
      return;
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    // Deactivate all sessions except current one
    const currentToken = req.header('Authorization')?.replace('Bearer ', '');
    await AdminSession.updateMany(
      { 
        adminId: admin._id, 
        isActive: true,
        token: { $ne: currentToken }
      },
      { $set: { isActive: false } }
    );

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change admin password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
