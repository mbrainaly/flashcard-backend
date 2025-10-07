// Predefined feature definitions for subscription plans
export interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  category: 'core' | 'ai' | 'content' | 'advanced' | 'collaboration';
  icon?: string;
}

export const AVAILABLE_FEATURES: FeatureDefinition[] = [
  // Core Features
  {
    key: 'basic_flashcards',
    name: 'Basic Flashcards',
    description: 'Create and study basic flashcards',
    category: 'core'
  },
  {
    key: 'unlimited_decks',
    name: 'Unlimited Decks',
    description: 'Create unlimited flashcard decks',
    category: 'core'
  },
  {
    key: 'unlimited_cards',
    name: 'Unlimited Cards',
    description: 'Add unlimited cards to your decks',
    category: 'core'
  },
  {
    key: 'offline_access',
    name: 'Offline Access',
    description: 'Study flashcards without internet connection',
    category: 'core'
  },
  {
    key: 'custom_categories',
    name: 'Custom Categories',
    description: 'Create custom categories for organization',
    category: 'core'
  },

  // AI Features
  {
    key: 'ai_flashcard_generation',
    name: 'AI Flashcard Generation',
    description: 'Generate flashcards using AI from text',
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
    description: 'Generate study notes from content using AI',
    category: 'ai'
  },
  {
    key: 'ai_study_assistant',
    name: 'AI Study Assistant',
    description: 'Get personalized study recommendations',
    category: 'ai'
  },
  {
    key: 'unlimited_ai_generations',
    name: 'Unlimited AI Generations',
    description: 'No limits on AI-powered content generation',
    category: 'ai'
  },

  // Content Features
  {
    key: 'document_upload',
    name: 'Document Upload',
    description: 'Upload PDF, DOCX, and TXT files',
    category: 'content'
  },
  {
    key: 'youtube_analysis',
    name: 'YouTube Video Analysis',
    description: 'Generate content from YouTube videos',
    category: 'content'
  },
  {
    key: 'image_upload',
    name: 'Image Upload',
    description: 'Add images to flashcards and notes',
    category: 'content'
  },
  {
    key: 'audio_recording',
    name: 'Audio Recording',
    description: 'Record and attach audio to flashcards',
    category: 'content'
  },
  {
    key: 'bulk_import',
    name: 'Bulk Import',
    description: 'Import flashcards from CSV or other formats',
    category: 'content'
  },

  // Advanced Features
  {
    key: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Detailed study progress and performance analytics',
    category: 'advanced'
  },
  {
    key: 'spaced_repetition',
    name: 'Advanced Spaced Repetition',
    description: 'Intelligent spaced repetition algorithms',
    category: 'advanced'
  },
  {
    key: 'custom_branding',
    name: 'Custom Branding',
    description: 'Customize the app with your own branding',
    category: 'advanced'
  },
  {
    key: 'api_access',
    name: 'API Access',
    description: 'Access to developer APIs for integrations',
    category: 'advanced'
  },
  {
    key: 'export_features',
    name: 'Export Features',
    description: 'Export flashcards to various formats',
    category: 'advanced'
  },
  {
    key: 'priority_support',
    name: 'Priority Support',
    description: '24/7 priority customer support',
    category: 'advanced'
  },

  // Collaboration Features
  {
    key: 'collaborative_decks',
    name: 'Collaborative Decks',
    description: 'Share and collaborate on flashcard decks',
    category: 'collaboration'
  },
  {
    key: 'team_management',
    name: 'Team Management',
    description: 'Manage team members and permissions',
    category: 'collaboration'
  },
  {
    key: 'shared_analytics',
    name: 'Shared Analytics',
    description: 'View team-wide study analytics',
    category: 'collaboration'
  },
  {
    key: 'bulk_user_management',
    name: 'Bulk User Management',
    description: 'Add and manage multiple users at once',
    category: 'collaboration'
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
  { key: 'core', name: 'Core Features', description: 'Essential flashcard functionality' },
  { key: 'ai', name: 'AI Features', description: 'AI-powered content generation and assistance' },
  { key: 'content', name: 'Content Features', description: 'File uploads and content import' },
  { key: 'advanced', name: 'Advanced Features', description: 'Advanced tools and customization' },
  { key: 'collaboration', name: 'Collaboration', description: 'Team and sharing features' }
];
