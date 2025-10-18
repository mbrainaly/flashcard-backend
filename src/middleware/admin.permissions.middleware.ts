import { Request, Response, NextFunction } from 'express';

// Permission constants
export const PERMISSIONS = {
  // User management
  USERS_READ: 'users.read',
  USERS_WRITE: 'users.write',
  USERS_DELETE: 'users.delete',
  
  // Content management
  CONTENT_READ: 'content.read',
  CONTENT_WRITE: 'content.write',
  CONTENT_DELETE: 'content.delete',
  
  // Analytics
  ANALYTICS_READ: 'analytics.read',
  
  // Subscriptions
  SUBSCRIPTIONS_READ: 'subscriptions.read',
  SUBSCRIPTIONS_WRITE: 'subscriptions.write',
  
  // Blog management
  BLOGS_READ: 'blogs.read',
  BLOGS_WRITE: 'blogs.write',
  BLOGS_DELETE: 'blogs.delete',
  
  // Page management
  PAGES_READ: 'pages.read',
  PAGES_WRITE: 'pages.write',
  
  // Queries management
  QUERIES_READ: 'queries.read',
  QUERIES_UPDATE: 'queries.update',
  QUERIES_DELETE: 'queries.delete',
  
  // System management
  SYSTEM_READ: 'system.read',
  SYSTEM_WRITE: 'system.write'
} as const;

// Role-based permission sets
export const ROLE_PERMISSIONS = {
  super_admin: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_WRITE,
    PERMISSIONS.CONTENT_DELETE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.SUBSCRIPTIONS_READ,
    PERMISSIONS.SUBSCRIPTIONS_WRITE,
    PERMISSIONS.BLOGS_READ,
    PERMISSIONS.BLOGS_WRITE,
    PERMISSIONS.BLOGS_DELETE,
    PERMISSIONS.PAGES_READ,
    PERMISSIONS.PAGES_WRITE,
    PERMISSIONS.QUERIES_READ,
    PERMISSIONS.QUERIES_UPDATE,
    PERMISSIONS.QUERIES_DELETE,
    PERMISSIONS.SYSTEM_READ,
    PERMISSIONS.SYSTEM_WRITE
  ],
  admin: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_WRITE,
    PERMISSIONS.CONTENT_DELETE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.SUBSCRIPTIONS_READ,
    PERMISSIONS.BLOGS_READ,
    PERMISSIONS.BLOGS_WRITE,
    PERMISSIONS.BLOGS_DELETE,
    PERMISSIONS.PAGES_READ,
    PERMISSIONS.PAGES_WRITE,
    PERMISSIONS.QUERIES_READ,
    PERMISSIONS.QUERIES_UPDATE,
    PERMISSIONS.QUERIES_DELETE
  ],
  moderator: [
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_WRITE,
    PERMISSIONS.BLOGS_READ,
    PERMISSIONS.BLOGS_WRITE
  ],
  analyst: [
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.SUBSCRIPTIONS_READ
  ]
} as const;

// @desc    Check if admin has specific permission
export const hasPermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      next();
      return;
    }

    // Check if admin has the specific permission
    if (!req.admin.permissions || !req.admin.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}`,
        requiredPermission: permission,
        adminRole: req.admin.role,
        adminPermissions: req.admin.permissions
      });
      return;
    }

    next();
  };
};

// @desc    Check if admin has any of the specified permissions
export const hasAnyPermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      next();
      return;
    }

    // Check if admin has any of the specified permissions
    const hasAnyPerm = permissions.some(permission => 
      req.admin.permissions && req.admin.permissions.includes(permission)
    );

    if (!hasAnyPerm) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required permissions (any of): ${permissions.join(', ')}`,
        requiredPermissions: permissions,
        adminRole: req.admin.role,
        adminPermissions: req.admin.permissions
      });
      return;
    }

    next();
  };
};

// @desc    Check if admin has all of the specified permissions
export const hasAllPermissions = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      next();
      return;
    }

    // Check if admin has all of the specified permissions
    const hasAllPerms = permissions.every(permission => 
      req.admin.permissions && req.admin.permissions.includes(permission)
    );

    if (!hasAllPerms) {
      const missingPermissions = permissions.filter(permission => 
        !req.admin.permissions || !req.admin.permissions.includes(permission)
      );

      res.status(403).json({
        success: false,
        message: `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
        requiredPermissions: permissions,
        missingPermissions,
        adminRole: req.admin.role,
        adminPermissions: req.admin.permissions
      });
      return;
    }

    next();
  };
};

// @desc    Require specific permissions (alias for hasAllPermissions for better readability)
export const requirePermissions = (permissions: string[]) => {
  return hasAllPermissions(...permissions);
};

// @desc    Check if admin has specific role
export const hasRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(req.admin.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
        requiredRoles: roles,
        adminRole: req.admin.role
      });
      return;
    }

    next();
  };
};

// @desc    Check if admin is super admin
export const isSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.admin) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.admin.role !== 'super_admin') {
    res.status(403).json({
      success: false,
      message: 'Super admin access required',
      adminRole: req.admin.role
    });
    return;
  }

  next();
};

// @desc    Resource-based permission check
export const canAccessResource = (resourceType: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const permission = `${resourceType}.${action}`;
    
    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      next();
      return;
    }

    // Check if admin has the specific permission
    if (!req.admin.permissions || !req.admin.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Cannot ${action} ${resourceType}`,
        requiredPermission: permission,
        adminRole: req.admin.role,
        adminPermissions: req.admin.permissions
      });
      return;
    }

    next();
  };
};

// @desc    Utility function to check permission programmatically
export const checkPermission = (admin: any, permission: string): boolean => {
  if (!admin) return false;
  if (admin.role === 'super_admin') return true;
  return admin.permissions && admin.permissions.includes(permission);
};

// @desc    Utility function to check if admin has any of the permissions
export const checkAnyPermission = (admin: any, permissions: string[]): boolean => {
  if (!admin) return false;
  if (admin.role === 'super_admin') return true;
  return permissions.some(permission => 
    admin.permissions && admin.permissions.includes(permission)
  );
};

// @desc    Utility function to get admin's effective permissions
export const getEffectivePermissions = (admin: any): string[] => {
  if (!admin) return [];
  if (admin.role === 'super_admin') return Object.values(PERMISSIONS);
  return admin.permissions || [];
};

// @desc    Middleware to add permission check functions to request
export const addPermissionHelpers = (req: Request, res: Response, next: NextFunction): void => {
  req.hasPermission = (permission: string) => checkPermission(req.admin, permission);
  req.hasAnyPermission = (permissions: string[]) => checkAnyPermission(req.admin, permissions);
  req.getPermissions = () => getEffectivePermissions(req.admin);
  
  next();
};

// Extend Request interface to include permission helper functions
declare global {
  namespace Express {
    interface Request {
      hasPermission?: (permission: string) => boolean;
      hasAnyPermission?: (permissions: string[]) => boolean;
      getPermissions?: () => string[];
    }
  }
}
