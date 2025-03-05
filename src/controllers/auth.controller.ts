import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

// Generate JWT Token
const generateToken = (id: string): string => {
  const token = jwt.sign(
    { id }, 
    process.env.JWT_SECRET as string
  );
  return token;
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Registration request received:', req.body);
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      console.log('Missing required fields:', { name: !!name, email: !!email, password: !!password });
      res.status(400).json({ message: 'Please provide all required fields' });
      return;
    }

    // Check if user exists
    console.log('Checking if user exists:', email);
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log('User already exists:', email);
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    // Create user
    console.log('Creating new user:', { name, email });
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      console.log('User created successfully:', user._id);
      res.status(201).json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          subscription: user.subscription
        },
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    console.error('Error in user registration:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ 
        success: false,
        message: 'Please provide email and password' 
      });
      return;
    }

    // Check for user email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
      return;
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscription: user.subscription
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Error in user login:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscription: user.subscription
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email } = req.body;

    // Validate input
    if (!name || !email) {
      res.status(400).json({ 
        success: false,
        message: 'Please provide name and email' 
      });
      return;
    }

    // Check if email is already taken (if email is being changed)
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      res.status(400).json({ 
        success: false,
        message: 'Email already in use' 
      });
      return;
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email },
      { new: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during profile update' 
    });
  }
};

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      res.status(400).json({ 
        success: false,
        message: 'Please provide current and new password' 
      });
      return;
    }

    // Get user
    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ 
        success: false,
        message: 'Current password is incorrect' 
      });
      return;
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during password change' 
    });
  }
}; 