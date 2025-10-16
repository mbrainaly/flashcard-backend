import { Request, Response } from 'express';
import { getUserCredits } from '../utils/dynamicCredits';

// @desc    Get user's current credit status for all features
// @route   GET /api/user/credits
// @access  Private
export const getUserCreditsStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Getting credit status for user:', req.user._id);
    
    const userCredits = await getUserCredits(req.user._id);
    
    console.log('User credits retrieved:', userCredits);
    
    res.status(200).json({
      success: true,
      data: userCredits
    });
  } catch (error) {
    console.error('Error getting user credits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credit status'
    });
  }
};
