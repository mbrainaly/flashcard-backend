import mongoose from 'mongoose'
import User from '../models/User'

export async function deductCredits(userId: mongoose.Types.ObjectId | string, cost: number): Promise<{ ok: boolean; remaining?: number } > {
  if (cost <= 0) return { ok: true }
  const updated = await User.findOneAndUpdate(
    { _id: userId, 'subscription.credits': { $gte: cost } },
    { $inc: { 'subscription.credits': -cost } },
    { new: true, projection: { 'subscription.credits': 1 } }
  )
  if (!updated) return { ok: false }
  return { ok: true, remaining: updated.subscription.credits }
}

export async function refundCredits(userId: mongoose.Types.ObjectId | string, cost: number): Promise<void> {
  if (cost <= 0) return
  await User.findByIdAndUpdate(userId, { $inc: { 'subscription.credits': cost } })
}


