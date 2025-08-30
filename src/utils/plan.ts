export type PlanId = 'basic' | 'pro' | 'team';

export interface PlanRules {
  allowDocuments: boolean;
  allowYoutubeAnalyze: boolean;
  allowAIFlashcards: boolean;
  allowAIStudyAssistant: boolean;
  monthlyQuizLimit: number | null; // null => unlimited
  monthlyNotesLimit: number | null; // null => unlimited
}

export const PLAN_RULES: Record<PlanId, PlanRules> = {
  basic: {
    allowDocuments: false,
    allowYoutubeAnalyze: false,
    allowAIFlashcards: false,
    allowAIStudyAssistant: false,
    monthlyQuizLimit: 3,
    monthlyNotesLimit: 3,
  },
  pro: {
    allowDocuments: true,
    allowYoutubeAnalyze: true,
    allowAIFlashcards: true,
    allowAIStudyAssistant: true,
    monthlyQuizLimit: 50,
    monthlyNotesLimit: 50,
  },
  team: {
    allowDocuments: true,
    allowYoutubeAnalyze: true,
    allowAIFlashcards: true,
    allowAIStudyAssistant: true,
    monthlyQuizLimit: null,
    monthlyNotesLimit: null,
  },
};

export function currentPeriodKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

