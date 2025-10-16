export const CREDIT_COSTS = {
  // AI Features
  flashcardGeneration: 1,
  quizGeneration: 2,
  notesAnalysis: 3,
  aiAssistant: 1,
  // Manual Creation
  deckCreation: 0, // Free to create decks
  cardCreation: 0, // Free to create cards
  quizCreation: 1, // 1 credit to create manual quiz
} as const;

export type CreditCosts = typeof CREDIT_COSTS;


