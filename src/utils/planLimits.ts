import User from '../models/User';
import SubscriptionPlan from '../models/SubscriptionPlan';

export interface PlanLimits {
  maxDecks: number;
  aiFlashcardCredits: number;
  aiQuizCredits: number;
  aiNotesCredits: number;
  aiAssistantCredits: number;
}

export const getUserPlanLimits = async (userId: string): Promise<PlanLimits> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    console.log('Getting plan limits for user:', userId, 'Plan ID:', user.subscription.plan);

    // Always try to get limits from database plan first
    try {
      const subscriptionPlan = await SubscriptionPlan.findById(user.subscription.plan);
      if (subscriptionPlan) {
        console.log('Found database plan:', subscriptionPlan.name, 'Features:', {
          maxDecks: subscriptionPlan.features.maxDecks,
          aiFlashcardCredits: subscriptionPlan.features.aiFlashcardCredits,
          aiQuizCredits: subscriptionPlan.features.aiQuizCredits,
          aiNotesCredits: subscriptionPlan.features.aiNotesCredits,
          aiAssistantCredits: subscriptionPlan.features.aiAssistantCredits
        });

        return {
          maxDecks: subscriptionPlan.features.maxDecks === 999999 ? Infinity : subscriptionPlan.features.maxDecks,
          aiFlashcardCredits: subscriptionPlan.features.aiFlashcardCredits === 999999 ? Infinity : subscriptionPlan.features.aiFlashcardCredits,
          aiQuizCredits: subscriptionPlan.features.aiQuizCredits === 999999 ? Infinity : subscriptionPlan.features.aiQuizCredits,
          aiNotesCredits: subscriptionPlan.features.aiNotesCredits === 999999 ? Infinity : subscriptionPlan.features.aiNotesCredits,
          aiAssistantCredits: subscriptionPlan.features.aiAssistantCredits === 999999 ? Infinity : subscriptionPlan.features.aiAssistantCredits,
        };
      } else {
        console.log('No database plan found for ID:', user.subscription.plan);
      }
    } catch (dbError) {
      console.log('Error fetching plan from database:', dbError);
    }

    // Only use legacy plan limits if it's actually a legacy plan name (string, not ObjectId)
    if (typeof user.subscription.plan === 'string' && ['basic', 'pro', 'team'].includes(user.subscription.plan)) {
      console.log('Using legacy plan limits for:', user.subscription.plan);
      switch (user.subscription.plan) {
        case 'basic':
          return {
            maxDecks: 1,
            aiFlashcardCredits: 5,
            aiQuizCredits: 5,
            aiNotesCredits: 5,
            aiAssistantCredits: 5,
          };
        case 'pro':
          return {
            maxDecks: 50,
            aiFlashcardCredits: 100,
            aiQuizCredits: 100,
            aiNotesCredits: 100,
            aiAssistantCredits: 100,
          };
        case 'team':
          return {
            maxDecks: Infinity,
            aiFlashcardCredits: Infinity,
            aiQuizCredits: Infinity,
            aiNotesCredits: Infinity,
            aiAssistantCredits: Infinity,
          };
      }
    }

    // If we reach here, something went wrong - return minimal limits and log error
    console.error('Could not determine plan limits for user:', userId, 'Plan:', user.subscription.plan);
    return {
      maxDecks: 1,
      aiFlashcardCredits: 1,
      aiQuizCredits: 1,
      aiNotesCredits: 1,
      aiAssistantCredits: 1,
    };
  } catch (error) {
    console.error('Error getting user plan limits:', error);
    // Return minimal limits as fallback
    return {
      maxDecks: 1,
      aiFlashcardCredits: 1,
      aiQuizCredits: 1,
      aiNotesCredits: 1,
      aiAssistantCredits: 1,
    };
  }
};

export const checkDeckLimit = async (userId: string): Promise<{ allowed: boolean; currentCount: number; maxAllowed: number; message?: string }> => {
  try {
    const Deck = require('../models/Deck').default;
    const limits = await getUserPlanLimits(userId);
    const currentCount = await Deck.countDocuments({ owner: userId });
    
    if (currentCount >= limits.maxDecks) {
      return {
        allowed: false,
        currentCount,
        maxAllowed: limits.maxDecks,
        message: `Deck limit reached. Your current plan allows up to ${limits.maxDecks === Infinity ? 'unlimited' : limits.maxDecks} decks. Please upgrade your plan to create more decks.`
      };
    }
    
    return {
      allowed: true,
      currentCount,
      maxAllowed: limits.maxDecks
    };
  } catch (error) {
    console.error('Error checking deck limit:', error);
    return {
      allowed: false,
      currentCount: 0,
      maxAllowed: 0,
      message: 'Error checking deck limit'
    };
  }
};

export const checkCardLimit = async (userId: string, deckId: string): Promise<{ allowed: boolean; currentCount: number; maxAllowed: number; message?: string }> => {
  try {
    const Card = require('../models/Card').default;
    const currentCount = await Card.countDocuments({ deck: deckId });
    
    // For now, allow unlimited cards per deck since we're using dynamic credits
    return {
      allowed: true,
      currentCount,
      maxAllowed: Infinity
    };
  } catch (error) {
    console.error('Error checking card limit:', error);
    return {
      allowed: false,
      currentCount: 0,
      maxAllowed: 0,
      message: 'Error checking card limit'
    };
  }
};

export const checkAiGenerationLimit = async (userId: string): Promise<{ allowed: boolean; currentCount: number; maxAllowed: number; message?: string }> => {
  try {
    const User = require('../models/User').default;
    const limits = await getUserPlanLimits(userId);
    
    // Get user's current AI generation usage
    const user = await User.findById(userId);
    if (!user) {
      return {
        allowed: false,
        currentCount: 0,
        maxAllowed: 0,
        message: 'User not found'
      };
    }

    const remainingCredits = user.subscription.credits || 0;
    const maxAllowed = Infinity; // Using dynamic credits system
    
    // Calculate used credits (maxAllowed - remainingCredits)
    const usedCredits = Math.max(0, maxAllowed - remainingCredits);
    
    // Allow if user has remaining credits or unlimited plan
    if (remainingCredits <= 0 && maxAllowed !== Infinity) {
      return {
        allowed: false,
        currentCount: usedCredits,
        maxAllowed: maxAllowed,
        message: `AI generation limit reached. You've used ${usedCredits} out of ${maxAllowed === Infinity ? 'unlimited' : maxAllowed} AI generations. Please upgrade your plan.`
      };
    }
    
    return {
      allowed: true,
      currentCount: usedCredits,
      maxAllowed: maxAllowed
    };
  } catch (error) {
    console.error('Error checking AI generation limit:', error);
    return {
      allowed: false,
      currentCount: 0,
      maxAllowed: 0,
      message: 'Error checking AI generation limit'
    };
  }
};

export const checkDailyAiLimit = async (userId: string): Promise<{ allowed: boolean; currentCount: number; maxAllowed: number; message?: string }> => {
  try {
    const User = require('../models/User').default;
    const limits = await getUserPlanLimits(userId);
    
    // Get user's daily AI usage (you might need to implement daily tracking)
    const user = await User.findById(userId);
    if (!user) {
      return {
        allowed: false,
        currentCount: 0,
        maxAllowed: 0,
        message: 'User not found'
      };
    }

    // For now, we'll use a simple check - you might want to implement proper daily tracking
    const today = new Date().toDateString();
    const dailyUsage = user.dailyAiUsage || {};
    const currentCount = dailyUsage[today] || 0;
    const maxAllowed = Infinity; // Using dynamic credits system
    
    if (currentCount >= maxAllowed && maxAllowed !== Infinity) {
      return {
        allowed: false,
        currentCount,
        maxAllowed,
        message: `Daily AI generation limit reached. Your current plan allows up to ${maxAllowed === Infinity ? 'unlimited' : maxAllowed} AI generations per day. Please upgrade your plan or try again tomorrow.`
      };
    }
    
    return {
      allowed: true,
      currentCount,
      maxAllowed
    };
  } catch (error) {
    console.error('Error checking daily AI limit:', error);
    return {
      allowed: false,
      currentCount: 0,
      maxAllowed: 0,
      message: 'Error checking daily AI limit'
    };
  }
};

export const checkMonthlyAiLimit = async (userId: string): Promise<{ allowed: boolean; currentCount: number; maxAllowed: number; message?: string }> => {
  try {
    const User = require('../models/User').default;
    const limits = await getUserPlanLimits(userId);
    
    // Get user's monthly AI usage
    const user = await User.findById(userId);
    if (!user) {
      return {
        allowed: false,
        currentCount: 0,
        maxAllowed: 0,
        message: 'User not found'
      };
    }

    // For now, we'll use a simple check - you might want to implement proper monthly tracking
    const currentMonth = new Date().getMonth() + '-' + new Date().getFullYear();
    const monthlyUsage = user.monthlyAiUsage || {};
    const currentCount = monthlyUsage[currentMonth] || 0;
    const maxAllowed = Infinity; // Using dynamic credits system
    
    if (currentCount >= maxAllowed && maxAllowed !== Infinity) {
      return {
        allowed: false,
        currentCount,
        maxAllowed,
        message: `Monthly AI generation limit reached. Your current plan allows up to ${maxAllowed === Infinity ? 'unlimited' : maxAllowed} AI generations per month. Please upgrade your plan or wait for next month.`
      };
    }
    
    return {
      allowed: true,
      currentCount,
      maxAllowed
    };
  } catch (error) {
    console.error('Error checking monthly AI limit:', error);
    return {
      allowed: false,
      currentCount: 0,
      maxAllowed: 0,
      message: 'Error checking monthly AI limit'
    };
  }
};

export const checkStorageLimit = async (userId: string, additionalSize: number = 0): Promise<{ allowed: boolean; currentUsage: number; maxAllowed: number; message?: string }> => {
  try {
    const User = require('../models/User').default;
    const limits = await getUserPlanLimits(userId);
    
    // Get user's current storage usage
    const user = await User.findById(userId);
    if (!user) {
      return {
        allowed: false,
        currentUsage: 0,
        maxAllowed: 0,
        message: 'User not found'
      };
    }

    const currentUsage = user.storageUsed || 0; // in MB
    const maxAllowed = Infinity; // Using dynamic credits system
    const totalAfterUpload = currentUsage + additionalSize;
    
    if (totalAfterUpload > maxAllowed && maxAllowed !== Infinity) {
      return {
        allowed: false,
        currentUsage,
        maxAllowed,
        message: `Storage limit exceeded. Your current plan allows up to ${maxAllowed === Infinity ? 'unlimited' : maxAllowed}MB of storage. Current usage: ${currentUsage}MB. Please upgrade your plan or delete some files.`
      };
    }
    
    return {
      allowed: true,
      currentUsage,
      maxAllowed
    };
  } catch (error) {
    console.error('Error checking storage limit:', error);
    return {
      allowed: false,
      currentUsage: 0,
      maxAllowed: 0,
      message: 'Error checking storage limit'
    };
  }
};

export const checkFileUploadSizeLimit = async (userId: string, fileSize: number): Promise<{ allowed: boolean; fileSize: number; maxAllowed: number; message?: string }> => {
  try {
    const limits = await getUserPlanLimits(userId);
    const fileSizeMB = fileSize / (1024 * 1024); // Convert bytes to MB
    const maxAllowed = Infinity; // Using dynamic credits system
    
    if (fileSizeMB > maxAllowed && maxAllowed !== Infinity) {
      return {
        allowed: false,
        fileSize: fileSizeMB,
        maxAllowed,
        message: `File size exceeds limit. Your current plan allows files up to ${maxAllowed === Infinity ? 'unlimited' : maxAllowed}MB. This file is ${fileSizeMB.toFixed(2)}MB. Please upgrade your plan or use a smaller file.`
      };
    }
    
    return {
      allowed: true,
      fileSize: fileSizeMB,
      maxAllowed
    };
  } catch (error) {
    console.error('Error checking file upload size limit:', error);
    return {
      allowed: false,
      fileSize: 0,
      maxAllowed: 0,
      message: 'Error checking file upload size limit'
    };
  }
};

export const checkConcurrentSessionLimit = async (userId: string): Promise<{ allowed: boolean; currentSessions: number; maxAllowed: number; message?: string }> => {
  try {
    const User = require('../models/User').default;
    const limits = await getUserPlanLimits(userId);
    
    // Get user's current active sessions
    const user = await User.findById(userId);
    if (!user) {
      return {
        allowed: false,
        currentSessions: 0,
        maxAllowed: 0,
        message: 'User not found'
      };
    }

    const currentSessions = user.activeSessions || 0;
    const maxAllowed = Infinity; // Using dynamic credits system
    
    if (currentSessions >= maxAllowed && maxAllowed !== Infinity) {
      return {
        allowed: false,
        currentSessions,
        maxAllowed,
        message: `Concurrent session limit reached. Your current plan allows up to ${maxAllowed === Infinity ? 'unlimited' : maxAllowed} concurrent sessions. Please upgrade your plan or end an existing session.`
      };
    }
    
    return {
      allowed: true,
      currentSessions,
      maxAllowed
    };
  } catch (error) {
    console.error('Error checking concurrent session limit:', error);
    return {
      allowed: false,
      currentSessions: 0,
      maxAllowed: 0,
      message: 'Error checking concurrent session limit'
    };
  }
};
