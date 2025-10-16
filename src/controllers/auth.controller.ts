import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import SubscriptionPlan from '../models/SubscriptionPlan';
import { sendMail } from '../config/mail';

// Generate JWT Token
const generateToken = (id: string): string => {
  const token = jwt.sign(
    { id }, 
    process.env.JWT_SECRET as string
  );
  return token;
};

// Helper function to find the free plan (price = 0)
const getFreePlan = async () => {
  try {
    // Look for a plan with $0 monthly price
    const freePlan = await SubscriptionPlan.findOne({
      'price.monthly': 0,
      'visibility.isActive': true,
      'visibility.isPublic': true
    }).lean();

    if (freePlan) {
      console.log('✅ Assigning free plan to new user:', freePlan.name, '(ID:', freePlan._id.toString() + ')');
      return freePlan._id.toString();
    }

    // Fallback to basic plan if no free plan found
    console.warn('⚠️ No free plan found in database, falling back to basic plan');
    return 'basic';
  } catch (error) {
    console.error('❌ Error finding free plan:', error);
    return 'basic'; // Fallback to basic plan
  }
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

    // Get the free plan for new users
    const freePlanId = await getFreePlan();

    // Get the plan details to set correct credits
    let planCredits = 0;
    if (freePlanId !== 'basic') {
      try {
        const SubscriptionPlan = require('../models/SubscriptionPlan').default;
        const planDetails = await SubscriptionPlan.findById(freePlanId);
        if (planDetails) {
          planCredits = planDetails.features.maxAiGenerations === 999999 ? 999999 : planDetails.features.maxAiGenerations;
          console.log('✅ Setting credits for new user:', planCredits, 'from plan:', planDetails.name);
        }
      } catch (error) {
        console.error('Error fetching plan details:', error);
        planCredits = 50; // Fallback
      }
    } else {
      planCredits = 50; // Basic plan default
    }

    // Create user with free plan
    console.log('Creating new user:', { name, email, planId: freePlanId });
    const user = await User.create({
      name,
      email,
      password,
      subscription: {
        plan: freePlanId,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for free plan
        credits: {
          aiFlashcards: 0,
          aiQuizzes: 0,
          aiNotes: 0,
          aiAssistant: 0
        }
      }
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

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' })
      return
    }

    const user = await User.findOne({ email })
    // For security, return success even if user not found
    if (!user) {
      res.status(200).json({ success: true, message: 'If an account exists, a reset email was sent.' })
      return
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 1000 * 60 * 60) // 1 hour
    user.resetPasswordToken = token
    user.resetPasswordExpires = expires
    await user.save({ validateBeforeSave: false })

    const appBase = process.env.FRONTEND_URL || 'http://localhost:3000'
    const resetUrl = `${appBase}/auth/reset-password?token=${token}`

    const html = `
      <p>Hello ${user.name || ''},</p>
      <p>You (or someone) requested a password reset for your account.</p>
      <p>Click the link below to reset your password. This link will expire in 1 hour.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `

    await sendMail({
      to: email,
      subject: 'Reset your password',
      html,
      fromName: 'AI Flashcards'
    })

    res.status(200).json({ success: true, message: 'Reset email sent' })
  } catch (error) {
    console.error('Error in forgotPassword:', error)
    res.status(500).json({ success: false, message: 'Server error while sending reset email' })
  }
}

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body
    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Token and new password are required' })
      return
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    })

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token' })
      return
    }

    user.password = password
    user.resetPasswordToken = null
    user.resetPasswordExpires = null
    await user.save()

    res.status(200).json({ success: true, message: 'Password reset successful' })
  } catch (error) {
    console.error('Error in resetPassword:', error)
    res.status(500).json({ success: false, message: 'Server error during password reset' })
  }
}

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
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
      return;
    }

    // Log login attempt details
    console.log('Login attempt:', {
      email,
      provider: user.provider,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0
    });

    // Check if user has a password (Google users might not have one initially)
    if (!user.password) {
      res.status(401).json({ 
        success: false,
        message: 'This account doesn\'t have a password. Please use Google login or set a password in your profile.' 
      });
      return;
    }

    // Check password with detailed logging
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      console.log('Password check result:', { isMatch });
      
      if (!isMatch) {
        res.status(401).json({ 
          success: false,
          message: 'Invalid credentials' 
        });
        return;
      }
    } catch (error) {
      console.error('Error comparing passwords:', error);
      res.status(401).json({ 
        success: false,
        message: 'Error validating credentials' 
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
        subscription: user.subscription,
        provider: user.provider
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
    const { currentPassword, newPassword, isGoogleUser } = req.body;

    // Validate input for regular users
    if (!isGoogleUser && (!currentPassword || !newPassword)) {
      res.status(400).json({ 
        success: false,
        message: 'Please provide current and new password' 
      });
      return;
    }
    
    // For Google users, only new password is required
    if (isGoogleUser && !newPassword) {
      res.status(400).json({ 
        success: false,
        message: 'Please provide new password' 
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

    // For Google users, skip password check
    if (!isGoogleUser && user.provider !== 'google') {
      // Check current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        res.status(401).json({ 
          success: false,
          message: 'Current password is incorrect' 
        });
        return;
      }
    }

    console.log('Before password update - User:', {
      email: user.email,
      provider: user.provider,
      hasPassword: !!user.password,
      isGoogleUser: isGoogleUser
    });
    
    // Update password
    user.password = newPassword;
    
    // If this is a Google user setting a password, ensure they can login with password too
    if (isGoogleUser || user.provider === 'google') {
      console.log('Google user setting password');
    }
    
    // Save with explicit runValidators option
    await user.save({ validateBeforeSave: true });
    
    // Verify the password was saved by retrieving the user again
    const updatedUser = await User.findById(user._id).select('+password');
    if (updatedUser) {
      console.log('After password update - User:', {
        email: updatedUser.email,
        provider: updatedUser.provider,
        hasPassword: !!updatedUser.password,
        passwordLength: updatedUser.password ? updatedUser.password.length : 0
      });
    } else {
      console.log('After password update - user not found when reloading');
    }

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

// @desc    Google OAuth authentication
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, image, providerId } = req.body;

    if (!email || !name) {
      res.status(400).json({
        success: false,
        message: 'Email and name are required'
      });
      return;
    }

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      // Update user information if they're already registered with Google
      if (user.provider === 'google') {
        user.name = name;
        user.image = image;
        user.providerId = providerId;
        await user.save();
      }
      // If user exists but with local auth, don't allow Google login to override
      else {
        res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please use email and password to login.'
        });
        return;
      }
    } else {
      // Get the free plan for new OAuth users
      const freePlanId = await getFreePlan();

      // Get the plan details to set correct credits
      let planCredits = 0;
      if (freePlanId !== 'basic') {
        try {
          const SubscriptionPlan = require('../models/SubscriptionPlan').default;
          const planDetails = await SubscriptionPlan.findById(freePlanId);
          if (planDetails) {
            planCredits = planDetails.features.maxAiGenerations === 999999 ? 999999 : planDetails.features.maxAiGenerations;
            console.log('✅ Setting credits for new OAuth user:', planCredits, 'from plan:', planDetails.name);
          }
        } catch (error) {
          console.error('Error fetching plan details for OAuth user:', error);
          planCredits = 50; // Fallback
        }
      } else {
        planCredits = 50; // Basic plan default
      }

      // Create new user
      user = await User.create({
        email,
        name,
        provider: 'google',
        providerId,
        image,
        password: undefined, // No password for OAuth users
        subscription: {
          plan: freePlanId,
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for free plan
          credits: {
            aiFlashcards: 0,
            aiQuizzes: 0,
            aiNotes: 0,
            aiAssistant: 0
          }
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        provider: user.provider,
        subscription: user.subscription
      },
      token
    });
  } catch (error) {
    console.error('Error during Google authentication:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during Google authentication'
    });
  }
};