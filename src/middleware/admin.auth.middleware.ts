import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin';
import AdminSession from '../models/AdminSession';

// Extend Request interface to include admin
declare global {
  namespace Express {
    interface Request {
      admin?: any;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  admin?: any;
}

interface JwtPayload {
  adminId: string;
  type: string;
  iat: number;
  exp: number;
}

// @desc    Protect admin routes - verify JWT token
export const protectAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route - No token provided'
      });
      return;
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      // Make sure it's an admin token
      if (decoded.type !== 'admin') {
        res.status(401).json({
          success: false,
          message: 'Not authorized to access this route - Invalid token type'
        });
        return;
      }

      // Check if session exists and is active
      const session = await AdminSession.findOne({
        token,
        isActive: true,
        expiresAt: { $gt: new Date() }
      });

      if (!session) {
        res.status(401).json({
          success: false,
          message: 'Not authorized to access this route - Session expired or invalid'
        });
        return;
      }

      // Get admin from token
      const admin = await Admin.findById(decoded.adminId);

      if (!admin) {
        res.status(401).json({
          success: false,
          message: 'Not authorized to access this route - Admin not found'
        });
        return;
      }

      // Check if admin is active
      if (!admin.isActive) {
        res.status(401).json({
          success: false,
          message: 'Not authorized to access this route - Account deactivated'
        });
        return;
      }

      // Update session last activity
      session.lastActivity = new Date();
      await session.save();

      // Add admin to request object
      req.admin = admin;
      next();

    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route - Invalid token'
      });
      return;
    }

  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
    return;
  }
};

// @desc    Admin role authorization middleware
export const authorizeAdmin = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route - Admin not authenticated'
      });
      return;
    }

    if (!roles.includes(req.admin.role)) {
      res.status(403).json({
        success: false,
        message: `Admin role ${req.admin.role} is not authorized to access this route`
      });
      return;
    }

    next();
  };
};

// @desc    Check if admin has specific permission
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route - Admin not authenticated'
      });
      return;
    }

    if (!req.admin.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        message: `Admin does not have required permission: ${permission}`
      });
      return;
    }

    next();
  };
};

// @desc    Check if admin has any of the specified permissions
export const requireAnyPermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route - Admin not authenticated'
      });
      return;
    }

    const hasPermission = permissions.some(permission => 
      req.admin.permissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: `Admin does not have any of the required permissions: ${permissions.join(', ')}`
      });
      return;
    }

    next();
  };
};

// @desc    Optional admin authentication - doesn't fail if no token
export const optionalAdminAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token, continue without admin
    if (!token) {
      next();
      return;
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      // Make sure it's an admin token
      if (decoded.type !== 'admin') {
        next();
        return;
      }

      // Check if session exists and is active
      const session = await AdminSession.findOne({
        token,
        isActive: true,
        expiresAt: { $gt: new Date() }
      });

      if (!session) {
        next();
        return;
      }

      // Get admin from token
      const admin = await Admin.findById(decoded.adminId);

      if (!admin || !admin.isActive) {
        next();
        return;
      }

      // Update session last activity
      session.lastActivity = new Date();
      await session.save();

      // Add admin to request object
      req.admin = admin;
      next();

    } catch (error) {
      // If token is invalid, continue without admin
      next();
    }

  } catch (error) {
    console.error('Optional admin auth middleware error:', error);
    next();
  }
};

// @desc    Rate limiting for admin login attempts
export const adminLoginRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  // This is a placeholder - you might want to implement Redis-based rate limiting
  // For now, we'll rely on the account locking mechanism in the Admin model
  next();
};
