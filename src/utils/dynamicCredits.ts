import mongoose from 'mongoose';
import User from '../models/User';
import SubscriptionPlan from '../models/SubscriptionPlan';
import Deck from '../models/Deck';

export type FeatureType = 'aiFlashcards' | 'aiQuizzes' | 'aiNotes' | 'aiAssistant' | 'decks';

export interface FeatureCredits {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
}

export interface UserCredits {
  aiFlashcards: FeatureCredits;
  aiQuizzes: FeatureCredits;
  aiNotes: FeatureCredits;
  aiAssistant: FeatureCredits;
  decks: FeatureCredits;
}

/**
 * Get user's current credit status for all features
 */
export async function getUserCredits(userId: string): Promise<UserCredits> {
  try {
    console.log('getUserCredits called with userId:', userId);
    
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found for ID:', userId);
      throw new Error('User not found');
    }

    console.log('Found user:', user._id, 'plan:', user.subscription?.plan);

    // Get user's subscription plan
    let subscriptionPlan = null;
    try {
      subscriptionPlan = await SubscriptionPlan.findById(user.subscription.plan);
    } catch (error) {
      console.log('Could not find subscription plan, using legacy defaults');
    }

    // Get plan limits (with fallbacks for legacy plans)
    const planLimits = subscriptionPlan ? {
      aiFlashcardCredits: subscriptionPlan.features.aiFlashcardCredits,
      aiQuizCredits: subscriptionPlan.features.aiQuizCredits,
      aiNotesCredits: subscriptionPlan.features.aiNotesCredits,
      aiAssistantCredits: subscriptionPlan.features.aiAssistantCredits,
      maxDecks: subscriptionPlan.features.maxDecks,
    } : getLegacyPlanLimits(user.subscription.plan);

    // Get user's current usage - handle both old (number) and new (object) structures
    let usage;
    if (typeof user.subscription.credits === 'object' && user.subscription.credits !== null) {
      // New structure: use the object directly
      usage = user.subscription.credits;
    } else {
      // Old structure: credits is a number, so all AI features start at 0
      usage = {
        aiFlashcards: 0,
        aiQuizzes: 0,
        aiNotes: 0,
        aiAssistant: 0
      };
    }
    
    // Ensure all properties exist with default values
    usage = {
      aiFlashcards: usage.aiFlashcards || 0,
      aiQuizzes: usage.aiQuizzes || 0,
      aiNotes: usage.aiNotes || 0,
      aiAssistant: usage.aiAssistant || 0
    };

    // Count user's current decks
    console.log('Counting decks for user:', user._id);
    const currentDecks = await Deck.countDocuments({ owner: user._id });
    console.log('User has', currentDecks, 'decks');

    // Calculate credits for each feature
    const userCredits: UserCredits = {
      aiFlashcards: calculateFeatureCredits(usage.aiFlashcards, planLimits.aiFlashcardCredits),
      aiQuizzes: calculateFeatureCredits(usage.aiQuizzes, planLimits.aiQuizCredits),
      aiNotes: calculateFeatureCredits(usage.aiNotes, planLimits.aiNotesCredits),
      aiAssistant: calculateFeatureCredits(usage.aiAssistant, planLimits.aiAssistantCredits),
      decks: calculateFeatureCredits(currentDecks, planLimits.maxDecks),
    };

    console.log('Returning user credits:', userCredits);
    return userCredits;
  } catch (error) {
    console.error('Error getting user credits:', error);
    throw error;
  }
}

/**
 * Deduct credits for a specific feature
 */
export async function deductFeatureCredits(
  userId: string, 
  feature: FeatureType, 
  cost: number = 1
): Promise<{ success: boolean; remaining?: number; message?: string }> {
  
  console.log(`[DYNAMIC CREDITS] Attempting to deduct ${cost} ${feature} credits from user ${userId}`);
  
  if (cost <= 0) {
    console.log(`[DYNAMIC CREDITS] Cost is ${cost}, no deduction needed`);
    return { success: true };
  }

  try {
    // Get current credit status
    const userCredits = await getUserCredits(userId);
    const featureCredits = userCredits[feature];

    console.log(`[DYNAMIC CREDITS] ${feature}: Used ${featureCredits.used}/${featureCredits.limit}, Remaining: ${featureCredits.remaining}`);

    // Check if user has enough credits
    if (!featureCredits.unlimited && featureCredits.remaining < cost) {
      console.log(`[DYNAMIC CREDITS] Insufficient ${feature} credits. Need ${cost}, have ${featureCredits.remaining}`);
      return {
        success: false,
        message: `Insufficient ${feature} credits. You have ${featureCredits.remaining} remaining, but need ${cost}.`
      };
    }

    // Deduct credits (only if not unlimited)
    if (!featureCredits.unlimited) {
      // Get the user to check current credit structure
      const user = await User.findById(userId);
      if (!user) {
        console.log(`[DYNAMIC CREDITS] User ${userId} not found`);
        return { success: false, message: 'User not found' };
      }

      let updated;
      
      console.log(`[DYNAMIC CREDITS] User credit structure:`, JSON.stringify(user.subscription.credits));
      console.log(`[DYNAMIC CREDITS] Type of credits:`, typeof user.subscription.credits);
      
      // Try to update with the new structure first - if it fails, we know we need to migrate
      try {
        console.log(`[DYNAMIC CREDITS] Attempting direct credit update...`);
        const updateField = `subscription.credits.${feature}`;
        updated = await User.findByIdAndUpdate(
          userId,
          { $inc: { [updateField]: cost } },
          { new: true, projection: { 'subscription.credits': 1 } }
        );
        console.log(`[DYNAMIC CREDITS] Direct update successful`);
      } catch (directUpdateError) {
        console.log(`[DYNAMIC CREDITS] Direct update failed, migrating user structure:`, directUpdateError instanceof Error ? directUpdateError.message : directUpdateError);
        
        // Migration needed - set new credit structure
        const newCreditsStructure = {
          aiFlashcards: feature === 'aiFlashcards' ? cost : 0,
          aiQuizzes: feature === 'aiQuizzes' ? cost : 0,
          aiNotes: feature === 'aiNotes' ? cost : 0,
          aiAssistant: feature === 'aiAssistant' ? cost : 0
        };
        
        console.log(`[DYNAMIC CREDITS] Setting new credit structure:`, newCreditsStructure);
        
        updated = await User.findByIdAndUpdate(
          userId,
          { $set: { 'subscription.credits': newCreditsStructure } },
          { new: true, projection: { 'subscription.credits': 1 } }
        );
        console.log(`[DYNAMIC CREDITS] Migration successful`);
      }

      if (!updated) {
        console.log(`[DYNAMIC CREDITS] Failed to update user ${userId}`);
        return { success: false, message: 'Failed to update user credits' };
      }

      const newRemaining = featureCredits.remaining - cost;
      console.log(`[DYNAMIC CREDITS] Successfully deducted ${cost} ${feature} credits. Remaining: ${newRemaining}`);
      
      return { 
        success: true, 
        remaining: newRemaining 
      };
    } else {
      console.log(`[DYNAMIC CREDITS] User has unlimited ${feature} credits`);
      return { success: true, remaining: Infinity };
    }

  } catch (error) {
    console.error(`[DYNAMIC CREDITS] Error deducting ${feature} credits:`, error);
    return { success: false, message: 'Internal error occurred' };
  }
}

/**
 * Refund credits for a specific feature
 */
export async function refundFeatureCredits(
  userId: string, 
  feature: FeatureType, 
  amount: number = 1
): Promise<void> {
  
  console.log(`[DYNAMIC CREDITS] Refunding ${amount} ${feature} credits to user ${userId}`);
  
  if (amount <= 0) return;

  try {
    // Get the user to check current credit structure
    const user = await User.findById(userId);
    if (!user) {
      console.log(`[DYNAMIC CREDITS] User ${userId} not found for refund`);
      return;
    }

    // Check if user has new credit structure (object) or old structure (number)
    if (typeof user.subscription.credits === 'object' && user.subscription.credits !== null) {
      // New structure: update specific feature credit
      const updateField = `subscription.credits.${feature}`;
      await User.findByIdAndUpdate(
        userId,
        { $inc: { [updateField]: -amount } }, // Subtract from used credits (refund)
        { new: true }
      );
    } else {
      // Old structure: migrate to new structure first
      console.log(`[DYNAMIC CREDITS] Migrating user ${userId} from old credit structure during refund`);
      
      // Initialize new credit structure with all features at 0 (since old structure doesn't track individual usage)
      const newCreditsStructure = {
        aiFlashcards: 0,
        aiQuizzes: 0,
        aiNotes: 0,
        aiAssistant: 0
      };
      
      console.log(`[DYNAMIC CREDITS] Setting new credit structure for refund:`, newCreditsStructure);
      
      await User.findByIdAndUpdate(
        userId,
        { $set: { 'subscription.credits': newCreditsStructure } },
        { new: true }
      );
    }
    
    console.log(`[DYNAMIC CREDITS] Successfully refunded ${amount} ${feature} credits`);
  } catch (error) {
    console.error(`[DYNAMIC CREDITS] Error refunding ${feature} credits:`, error);
  }
}

/**
 * Helper function to calculate feature credits
 */
function calculateFeatureCredits(used: number, limit: number): FeatureCredits {
  const unlimited = limit === 999999 || limit === Infinity;
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  
  return {
    used,
    limit: unlimited ? Infinity : limit,
    remaining,
    unlimited
  };
}

/**
 * Get legacy plan limits for backward compatibility
 */
function getLegacyPlanLimits(planId: string) {
  switch (planId) {
    case 'basic':
      return {
        aiFlashcardCredits: 10,
        aiQuizCredits: 5,
        aiNotesCredits: 3,
        aiAssistantCredits: 5,
        maxDecks: 1
      };
    case 'pro':
      return {
        aiFlashcardCredits: 100,
        aiQuizCredits: 50,
        aiNotesCredits: 30,
        aiAssistantCredits: 50,
        maxDecks: 100
      };
    case 'team':
      return {
        aiFlashcardCredits: 999999,
        aiQuizCredits: 999999,
        aiNotesCredits: 999999,
        aiAssistantCredits: 999999,
        maxDecks: 999999
      };
    default:
      return {
        aiFlashcardCredits: 1,
        aiQuizCredits: 1,
        aiNotesCredits: 1,
        aiAssistantCredits: 1,
        maxDecks: 1
      };
  }
}
