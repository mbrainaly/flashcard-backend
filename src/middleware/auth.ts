import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

interface JwtPayload {
  id: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer')) {
      res.status(401).json({ 
        success: false,
        message: 'Authorization header missing or invalid format' 
      });
      return;
    }

    // Extract token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ 
        success: false,
        message: 'No token provided' 
      });
      return;
    }

    try {
      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as JwtPayload;

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        res.status(401).json({ 
          success: false,
          message: 'User not found or token invalid' 
        });
        return;
      }

      // Attach user to request object
      req.user = user;
      next();
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      res.status(401).json({ 
        success: false,
        message: 'Invalid or expired token' 
      });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error during authentication' 
    });
    return;
  }
}; 