// Predefined feature definitions for subscription plans
export interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  category: 'ai' | 'content';
  icon?: string;
}

export const AVAILABLE_FEATURES: FeatureDefinition[] = [
  // AI Features - AI-powered content generation
  {
    key: 'ai_flashcard_generation',
    name: 'AI Flashcard Generation',
    description: 'Generate flashcards using AI from text content',
    category: 'ai'
  },
  {
    key: 'ai_quiz_generation',
    name: 'AI Quiz Generation',
    description: 'Create quizzes automatically using AI',
    category: 'ai'
  },
  {
    key: 'ai_notes_generation',
    name: 'AI Notes Generation',
    description: 'Generate study notes from uploaded content using AI',
    category: 'ai'
  },
  {
    key: 'ai_study_assistant',
    name: 'AI Study Assistant',
    description: 'Notes Q&A, concept explanations, practice problems, homework help',
    category: 'ai'
  },
  {
    key: 'unlimited_ai_generations',
    name: 'Unlimited AI Generations',
    description: 'No limits on AI-powered content generation',
    category: 'ai'
  },
  {
    key: 'youtube_analysis',
    name: 'YouTube Video Analysis',
    description: 'Generate flashcards and notes from YouTube videos',
    category: 'ai'
  },

  // Content Features - File handling and content management
  {
    key: 'document_upload',
    name: 'Document Upload',
    description: 'Upload PDF, DOCX, and TXT files for AI processing',
    category: 'content'
  },
  {
    key: 'notes_management',
    name: 'Notes Management',
    description: 'Create, edit, and organize study notes',
    category: 'content'
  },
  {
    key: 'quiz_taking',
    name: 'Quiz Taking',
    description: 'Take interactive quizzes and track performance',
    category: 'content'
  },
  {
    key: 'deck_editing',
    name: 'Deck Editing',
    description: 'Edit and customize flashcard decks',
    category: 'content'
  }
];

// Helper function to get feature by key
export const getFeatureByKey = (key: string): FeatureDefinition | undefined => {
  return AVAILABLE_FEATURES.find(feature => feature.key === key);
};

// Helper function to get features by category
export const getFeaturesByCategory = (category: string): FeatureDefinition[] => {
  return AVAILABLE_FEATURES.filter(feature => feature.category === category);
};

// Helper function to check if a feature is available in a plan
export const hasFeature = (planFeatures: string[], featureKey: string): boolean => {
  return planFeatures.includes(featureKey);
};

// Feature categories for organization
export const FEATURE_CATEGORIES = [
  { key: 'ai', name: 'AI Features', description: 'AI-powered content generation and assistance' },
  { key: 'content', name: 'Content Features', description: 'File uploads and content management' }
];