import { Plan, SubscriptionPlan } from '../models'
import { PLAN_RULES, PlanId, PlanRules } from './plan'

export async function getPlanRulesForId(planId: PlanId | string): Promise<PlanRules> {
  try {
    console.log('Getting plan rules for planId:', planId)
    
    // Check if planId is a MongoDB ObjectId (24 hex characters)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(planId)
    
    if (isObjectId) {
      console.log('planId is an ObjectId, looking up SubscriptionPlan...')
      // Look up the SubscriptionPlan document
      const subscriptionPlan = await SubscriptionPlan.findById(planId).lean()
      console.log('Found subscription plan:', subscriptionPlan)
      
      if (subscriptionPlan) {
        // Extract permissions from the SubscriptionPlan's selectedFeatures
        const features = subscriptionPlan.selectedFeatures || []
        console.log('SubscriptionPlan selectedFeatures:', features)
        console.log('SubscriptionPlan features object:', subscriptionPlan.features)
        
        const rules = {
          allowDocuments: features.includes('allowDocuments') || features.includes('fileUpload') || features.includes('documentUpload'),
          allowYoutubeAnalyze: features.includes('allowYoutubeAnalyze') || features.includes('youtubeAnalysis') || features.includes('youtubeIntegration'),
          allowAIFlashcards: features.includes('allowAIFlashcards') || features.includes('aiFlashcards') || features.includes('aiFlashcardGeneration'),
          allowAIStudyAssistant: features.includes('allowAIStudyAssistant') || features.includes('aiAssistant') || features.includes('aiStudyAssistant') || !!(subscriptionPlan.features?.aiAssistantCredits && subscriptionPlan.features.aiAssistantCredits > 0),
          monthlyQuizLimit: subscriptionPlan.features?.aiQuizCredits || null,
          monthlyNotesLimit: subscriptionPlan.features?.aiNotesCredits || null,
        }
        console.log('Feature mapping results:')
        console.log('- allowAIStudyAssistant checks:', {
          'features.includes(allowAIStudyAssistant)': features.includes('allowAIStudyAssistant'),
          'features.includes(aiAssistant)': features.includes('aiAssistant'),
          'features.includes(aiStudyAssistant)': features.includes('aiStudyAssistant'),
          'aiAssistantCredits > 0': subscriptionPlan.features?.aiAssistantCredits && subscriptionPlan.features.aiAssistantCredits > 0,
          'final result': rules.allowAIStudyAssistant
        })
        console.log('Returning SubscriptionPlan rules:', rules)
        return rules
      }
    } else {
      console.log('planId is a legacy plan name, looking up Plan...')
      // Legacy plan lookup
      const doc = await Plan.findOne({ id: planId }).lean()
      console.log('Found legacy plan document:', doc)
      
      if (doc) {
        const rules = {
          allowDocuments: !!doc.allowDocuments,
          allowYoutubeAnalyze: !!doc.allowYoutubeAnalyze,
          allowAIFlashcards: !!doc.allowAIFlashcards,
          allowAIStudyAssistant: !!doc.allowAIStudyAssistant,
          monthlyQuizLimit: doc.monthlyQuizLimit === null ? null : Number(doc.monthlyQuizLimit),
          monthlyNotesLimit: doc.monthlyNotesLimit === null ? null : Number(doc.monthlyNotesLimit),
        }
        console.log('Returning legacy plan rules:', rules)
        return rules
      }
    }
  } catch (error) {
    console.error('Error fetching plan from database:', error)
  }
  
  console.log('Falling back to default PLAN_RULES for:', planId)
  const fallbackRules = PLAN_RULES[planId as PlanId]
  console.log('Fallback rules:', fallbackRules)
  
  if (!fallbackRules) {
    console.error('No fallback rules found for planId:', planId, 'Available plans:', Object.keys(PLAN_RULES))
    // Return basic plan as ultimate fallback
    return PLAN_RULES.basic
  }
  
  return fallbackRules
}


