import mongoose from 'mongoose'
import User from '../models/User'

export async function deductCredits(userId: mongoose.Types.ObjectId | string, cost: number): Promise<{ ok: boolean; remaining?: any } > {
  console.log(`[CREDITS] Attempting to deduct ${cost} credits from user ${userId}`);
  
  if (cost <= 0) {
    console.log(`[CREDITS] Cost is ${cost}, no deduction needed`);
    return { ok: true }
  }
  
  // First, check current credits and plan details
  const user = await User.findById(userId, { 'subscription.credits': 1, 'subscription.plan': 1 });
  if (!user) {
    console.log(`[CREDITS] User not found: ${userId}`);
    return { ok: false }
  }
  
  // Get the user's plan limits to check what their credits should be
  const { getUserPlanLimits } = require('./planLimits');
  const planLimits = await getUserPlanLimits(userId);
  
  console.log(`[CREDITS] User has ${user.subscription?.credits || 0} stored credits, needs ${cost}`);
  console.log(`[CREDITS] User's plan allows ${planLimits.maxAiGenerations === Infinity ? 'unlimited' : planLimits.maxAiGenerations} total AI generations`);
  console.log(`[CREDITS] User's plan ID: ${user.subscription.plan}`);
  
  const updated = await User.findOneAndUpdate(
    { _id: userId, 'subscription.credits': { $gte: cost } },
    { $inc: { 'subscription.credits': -cost } },
    { new: true, projection: { 'subscription.credits': 1 } }
  )
  
  if (!updated) {
    console.log(`[CREDITS] Deduction failed - insufficient credits`);
    return { ok: false }
  }
  
  console.log(`[CREDITS] Successfully deducted ${cost} credits. Remaining: ${updated.subscription.credits}`);
  return { ok: true, remaining: updated.subscription.credits }
}

export async function refundCredits(userId: mongoose.Types.ObjectId | string, cost: number): Promise<void> {
  console.log(`[CREDITS] Refunding ${cost} credits to user ${userId}`);
  if (cost <= 0) return
  await User.findByIdAndUpdate(userId, { $inc: { 'subscription.credits': cost } })
  console.log(`[CREDITS] Successfully refunded ${cost} credits`);
}

export async function syncUserCreditsWithPlan(userId: mongoose.Types.ObjectId | string): Promise<void> {
  console.log(`[CREDITS] Syncing user credits with plan for user ${userId}`);
  
  try {
    const { getUserPlanLimits } = require('./planLimits');
    const planLimits = await getUserPlanLimits(userId);
    
    const user = await User.findById(userId, { 'subscription.credits': 1, 'subscription.plan': 1 });
    if (!user) {
      console.log(`[CREDITS] User not found for sync: ${userId}`);
      return;
    }
    
    const currentCredits = user.subscription?.credits || 0;
    const planMaxCredits = planLimits.maxAiGenerations === Infinity ? 999999 : planLimits.maxAiGenerations;
    
    console.log(`[CREDITS] Current stored credits: ${currentCredits}`);
    console.log(`[CREDITS] Plan max credits: ${planMaxCredits}`);
    
    // If stored credits are higher than plan allows, cap them to plan limit
    if (currentCredits > planMaxCredits) {
      await User.findByIdAndUpdate(userId, { 
        $set: { 'subscription.credits': planMaxCredits } 
      });
      console.log(`[CREDITS] Capped user credits from ${currentCredits} to ${planMaxCredits} based on plan limits`);
    }
    // If stored credits are lower than plan allows, set them to plan limit (monthly refresh)
    else if (currentCredits < planMaxCredits) {
      await User.findByIdAndUpdate(userId, { 
        $set: { 'subscription.credits': planMaxCredits } 
      });
      console.log(`[CREDITS] Increased user credits from ${currentCredits} to ${planMaxCredits} based on plan limits`);
    } else {
      console.log(`[CREDITS] User credits are already in sync with plan`);
    }
  } catch (error) {
    console.error(`[CREDITS] Error syncing user credits:`, error);
  }
}


