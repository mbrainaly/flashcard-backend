import { Plan } from '../models'
import { PLAN_RULES, PlanId, PlanRules } from './plan'

export async function getPlanRulesForId(planId: PlanId): Promise<PlanRules> {
  try {
    const doc = await Plan.findOne({ id: planId }).lean()
    if (doc) {
      return {
        allowDocuments: !!doc.allowDocuments,
        allowYoutubeAnalyze: !!doc.allowYoutubeAnalyze,
        allowAIFlashcards: !!doc.allowAIFlashcards,
        allowAIStudyAssistant: !!doc.allowAIStudyAssistant,
        monthlyQuizLimit: doc.monthlyQuizLimit === null ? null : Number(doc.monthlyQuizLimit),
        monthlyNotesLimit: doc.monthlyNotesLimit === null ? null : Number(doc.monthlyNotesLimit),
      }
    }
  } catch (_) {}
  return PLAN_RULES[planId]
}


