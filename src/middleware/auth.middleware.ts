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
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as JwtPayload;

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401).json({ 
          success: false,
          message: 'User not found' 
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ 
        success: false,
        message: 'Not authorized, token failed' 
      });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ 
      success: false,
      message: 'Not authorized, no token' 
    });
    return;
  }
}; 