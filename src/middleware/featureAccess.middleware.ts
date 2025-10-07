import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import SubscriptionPlan from '../models/SubscriptionPlan';
import { AVAILABLE_FEATURES, hasFeature } from '../config/features';

// Extend Request interface to include user feature access
declare global {
  namespace Express {
    interface Request {
      userFeatures?: string[];
      hasFeature?: (featureKey: string) => boolean;
    }
  }
}

/**
 * Middleware to load user's available features based on their subscription plan
 */
export const loadUserFeatures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next();
    }

    const user = await User.findById(req.user._id).lean();
    if (!user || !user.subscription?.plan) {
      req.userFeatures = [];
      req.hasFeature = () => false;
      return next();
    }

    let userFeatures: string[] = [];

    // Try to get features from database plan
    try {
      const subscriptionPlan = await SubscriptionPlan.findById(user.subscription.plan).lean();
      if (subscriptionPlan && subscriptionPlan.selectedFeatures) {
        userFeatures = subscriptionPlan.selectedFeatures;
      }
    } catch (dbError) {
      console.log('Plan not found in database, using legacy plan features...');
    }

    // Fallback for legacy plans
    if (userFeatures.length === 0) {
      switch (user.subscription.plan) {
        case 'basic':
          userFeatures = [
            'basic_flashcards',
            'offline_access'
          ];
          break;
        case 'pro':
          userFeatures = [
            'basic_flashcards',
            'unlimited_decks',
            'unlimited_cards',
            'offline_access',
            'custom_categories',
            'ai_flashcard_generation',
            'ai_quiz_generation',
            'ai_notes_generation',
            'document_upload',
            'youtube_analysis',
            'image_upload',
            'advanced_analytics',
            'export_features'
          ];
          break;
        case 'team':
          userFeatures = [
            'basic_flashcards',
            'unlimited_decks',
            'unlimited_cards',
            'offline_access',
            'custom_categories',
            'ai_flashcard_generation',
            'ai_quiz_generation',
            'ai_notes_generation',
            'ai_study_assistant',
            'unlimited_ai_generations',
            'document_upload',
            'youtube_analysis',
            'image_upload',
            'audio_recording',
            'bulk_import',
            'advanced_analytics',
            'spaced_repetition',
            'custom_branding',
            'api_access',
            'export_features',
            'priority_support',
            'collaborative_decks',
            'team_management',
            'shared_analytics',
            'bulk_user_management'
          ];
          break;
        default:
          userFeatures = ['basic_flashcards'];
      }
    }

    // Add features to request object
    req.userFeatures = userFeatures;
    req.hasFeature = (featureKey: string) => hasFeature(userFeatures, featureKey);

    next();
  } catch (error) {
    console.error('Error loading user features:', error);
    req.userFeatures = [];
    req.hasFeature = () => false;
    next();
  }
};

/**
 * Middleware to require a specific feature for route access
 */
export const requireFeature = (featureKey: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.hasFeature || !req.hasFeature(featureKey)) {
      return res.status(403).json({
        success: false,
        message: `This feature requires a subscription plan that includes: ${featureKey}`,
        featureRequired: featureKey,
        upgradeRequired: true
      });
    }
    next();
  };
};

/**
 * Utility function to check if user has feature access (for use in controllers)
 */
export const checkUserFeatureAccess = async (userId: string, featureKey: string): Promise<boolean> => {
  try {
    const user = await User.findById(userId).lean();
    if (!user || !user.subscription?.plan) {
      return false;
    }

    // Try to get features from database plan
    try {
      const subscriptionPlan = await SubscriptionPlan.findById(user.subscription.plan).lean();
      if (subscriptionPlan && subscriptionPlan.selectedFeatures) {
        return hasFeature(subscriptionPlan.selectedFeatures, featureKey);
      }
    } catch (dbError) {
      // Fallback to legacy plan logic
    }

    // Legacy plan fallback
    const legacyFeatures = getLegacyPlanFeatures(user.subscription.plan);
    return hasFeature(legacyFeatures, featureKey);
  } catch (error) {
    console.error('Error checking user feature access:', error);
    return false;
  }
};

/**
 * Get user's available features
 */
export const getUserFeatures = async (userId: string): Promise<string[]> => {
  try {
    const user = await User.findById(userId).lean();
    if (!user || !user.subscription?.plan) {
      return [];
    }

    // Try to get features from database plan
    try {
      const subscriptionPlan = await SubscriptionPlan.findById(user.subscription.plan).lean();
      if (subscriptionPlan && subscriptionPlan.selectedFeatures) {
        return subscriptionPlan.selectedFeatures;
      }
    } catch (dbError) {
      // Fallback to legacy plan logic
    }

    // Legacy plan fallback
    return getLegacyPlanFeatures(user.subscription.plan);
  } catch (error) {
    console.error('Error getting user features:', error);
    return [];
  }
};

/**
 * Helper function for legacy plan features
 */
const getLegacyPlanFeatures = (planName: string): string[] => {
  switch (planName) {
    case 'basic':
      return ['basic_flashcards', 'offline_access'];
    case 'pro':
      return [
        'basic_flashcards',
        'unlimited_decks',
        'unlimited_cards',
        'offline_access',
        'custom_categories',
        'ai_flashcard_generation',
        'ai_quiz_generation',
        'ai_notes_generation',
        'document_upload',
        'youtube_analysis',
        'image_upload',
        'advanced_analytics',
        'export_features'
      ];
    case 'team':
      return [
        'basic_flashcards',
        'unlimited_decks',
        'unlimited_cards',
        'offline_access',
        'custom_categories',
        'ai_flashcard_generation',
        'ai_quiz_generation',
        'ai_notes_generation',
        'ai_study_assistant',
        'unlimited_ai_generations',
        'document_upload',
        'youtube_analysis',
        'image_upload',
        'audio_recording',
        'bulk_import',
        'advanced_analytics',
        'spaced_repetition',
        'custom_branding',
        'api_access',
        'export_features',
        'priority_support',
        'collaborative_decks',
        'team_management',
        'shared_analytics',
        'bulk_user_management'
      ];
    default:
      return ['basic_flashcards'];
  }
};
