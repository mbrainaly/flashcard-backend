import Plan from '../models/Plan'
import { SUBSCRIPTION_PLANS } from '../config/stripe'

export async function seedDefaultPlans(): Promise<void> {
  const existing = await Plan.countDocuments({})
  if (existing > 0) return
  await Plan.insertMany([
    {
      id: SUBSCRIPTION_PLANS.BASIC.id,
      name: SUBSCRIPTION_PLANS.BASIC.name,
      price: SUBSCRIPTION_PLANS.BASIC.price,
      monthlyCredits: SUBSCRIPTION_PLANS.BASIC.credits,
      allowDocuments: false,
      allowYoutubeAnalyze: false,
      allowAIFlashcards: false,
      allowAIStudyAssistant: false,
      monthlyQuizLimit: 3,
      monthlyNotesLimit: 3,
      features: [
        'Unlimited Non-AI Flashcards',
        '50 Credits / month',
        'No Document Uploading',
        'No YouTube Video URL Analyze',
        '3 Quiz Generation',
        '3 Notes Generation',
        'No AI Study Assistant',
      ],
    },
    {
      id: SUBSCRIPTION_PLANS.PRO.id,
      name: SUBSCRIPTION_PLANS.PRO.name,
      price: SUBSCRIPTION_PLANS.PRO.price,
      monthlyCredits: SUBSCRIPTION_PLANS.PRO.credits,
      allowDocuments: true,
      allowYoutubeAnalyze: true,
      allowAIFlashcards: true,
      allowAIStudyAssistant: true,
      monthlyQuizLimit: 50,
      monthlyNotesLimit: 50,
      features: [
        'Unlimited AI flashcards',
        '200 Credits / month',
        'Document Uploading',
        'YouTube Video URL Analyze',
        '50 Quiz Generation',
        '50 Notes Generation',
        'AI Study Assistant',
      ],
    },
    {
      id: SUBSCRIPTION_PLANS.TEAM.id,
      name: SUBSCRIPTION_PLANS.TEAM.name,
      price: SUBSCRIPTION_PLANS.TEAM.price,
      monthlyCredits: SUBSCRIPTION_PLANS.TEAM.credits,
      allowDocuments: true,
      allowYoutubeAnalyze: true,
      allowAIFlashcards: true,
      allowAIStudyAssistant: true,
      monthlyQuizLimit: null,
      monthlyNotesLimit: null,
      features: [
        'Unlimited AI flashcards',
        '500 Credits / month',
        'Document Uploading',
        'YouTube Video URL Analyze',
        'Unlimited Quiz Generation',
        'Unlimited Notes Generation',
        'AI Study Assistant',
      ],
    },
  ])
}


