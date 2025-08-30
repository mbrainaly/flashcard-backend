export const CREDIT_COSTS = {
  flashcardGeneration: 1,
  quizGeneration: 2,
  notesAnalysis: 3,
  aiAssistant: 1,
} as const;

export type CreditCosts = typeof CREDIT_COSTS;


