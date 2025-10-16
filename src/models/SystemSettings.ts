import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemSettings extends Document {
  _id: string;
  general: {
    siteName: string;
    siteUrl: string;
    adminEmail: string;
    timezone: string;
    dateFormat: string;
    language: string;
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    emailVerificationRequired: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
    newUserRegistration: boolean;
    paymentAlerts: boolean;
    systemAlerts: boolean;
    securityAlerts: boolean;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    passwordMinLength: number;
    requireStrongPasswords: boolean;
    twoFactorRequired: boolean;
    ipWhitelist: string[];
    allowedFileTypes: string[];
    maxFileSize: number;
  };
  email: {
    provider: string;
    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
    encryption: string;
  };
  storage: {
    provider: string;
    awsAccessKey: string;
    awsSecretKey: string;
    awsBucket: string;
    awsRegion: string;
    maxStorageSize: number;
    compressionEnabled: boolean;
  };
  analytics: {
    googleAnalyticsEnabled: boolean;
    googleAnalyticsId: string;
    hotjarEnabled: boolean;
    hotjarId: string;
    customAnalytics: boolean;
  };
  backup: {
    enabled: boolean;
    frequency: string;
    retention: number;
    location: string;
    lastBackup?: Date;
  };
  performance: {
    cacheEnabled: boolean;
    cacheTtl: number;
    compressionEnabled: boolean;
    cdnEnabled: boolean;
    cdnUrl: string;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    twitterTitle: string;
    twitterDescription: string;
    twitterImage: string;
    favicon: string;
    logoUrl: string;
    robotsTxt: string;
  };
  lastModified: Date;
  lastModifiedBy: {
    adminId: mongoose.Types.ObjectId;
    name: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>({
  general: {
    siteName: { type: String, required: true, default: 'FlashCard App' },
    siteUrl: { type: String, required: true, default: 'https://flashcardapp.com' },
    adminEmail: { type: String, required: true },
    timezone: { type: String, default: 'America/Los_Angeles' },
    dateFormat: { type: String, default: 'MM/DD/YYYY' },
    language: { type: String, default: 'en' },
    maintenanceMode: { type: Boolean, default: false },
    registrationEnabled: { type: Boolean, default: true },
    emailVerificationRequired: { type: Boolean, default: true }
  },
  notifications: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    newUserRegistration: { type: Boolean, default: true },
    paymentAlerts: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true }
  },
  security: {
    sessionTimeout: { type: Number, default: 1440 }, // 24 hours in minutes
    maxLoginAttempts: { type: Number, default: 5 },
    passwordMinLength: { type: Number, default: 8 },
    requireStrongPasswords: { type: Boolean, default: true },
    twoFactorRequired: { type: Boolean, default: false },
    ipWhitelist: [{ type: String }],
    allowedFileTypes: {
      type: [String],
      default: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt']
    },
    maxFileSize: { type: Number, default: 10 } // MB
  },
  email: {
    provider: { type: String, default: 'smtp' },
    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 587 },
    smtpUsername: { type: String, default: '' },
    smtpPassword: { type: String, default: '' },
    fromEmail: { type: String, default: '' },
    fromName: { type: String, default: 'FlashCard App' },
    encryption: { type: String, default: 'tls' }
  },
  storage: {
    provider: { type: String, default: 'aws' },
    awsAccessKey: { type: String, default: '' },
    awsSecretKey: { type: String, default: '' },
    awsBucket: { type: String, default: '' },
    awsRegion: { type: String, default: 'us-west-2' },
    maxStorageSize: { type: Number, default: 1000 }, // GB
    compressionEnabled: { type: Boolean, default: true }
  },
  analytics: {
    googleAnalyticsEnabled: { type: Boolean, default: false },
    googleAnalyticsId: { type: String, default: '' },
    hotjarEnabled: { type: Boolean, default: false },
    hotjarId: { type: String, default: '' },
    customAnalytics: { type: Boolean, default: false }
  },
  backup: {
    enabled: { type: Boolean, default: true },
    frequency: { type: String, default: 'daily' },
    retention: { type: Number, default: 30 }, // days
    location: { type: String, default: 'aws-s3' },
    lastBackup: { type: Date }
  },
  performance: {
    cacheEnabled: { type: Boolean, default: true },
    cacheTtl: { type: Number, default: 3600 }, // seconds
    compressionEnabled: { type: Boolean, default: true },
    cdnEnabled: { type: Boolean, default: false },
    cdnUrl: { type: String, default: '' }
  },
  seo: {
    metaTitle: { type: String, default: 'FlashCard App - Master Any Subject with AI-Powered Flashcards' },
    metaDescription: { type: String, default: 'Create, study, and master any subject with our AI-powered flashcard platform. Generate smart flashcards, take quizzes, and track your progress.' },
    metaKeywords: { type: String, default: 'flashcards, study, learning, AI, education, quiz, memory, spaced repetition' },
    ogTitle: { type: String, default: 'FlashCard App - AI-Powered Learning Platform' },
    ogDescription: { type: String, default: 'Transform your learning with AI-generated flashcards and intelligent study tools.' },
    ogImage: { type: String, default: '/images/og-image.jpg' },
    twitterTitle: { type: String, default: 'FlashCard App - Smart Learning Made Simple' },
    twitterDescription: { type: String, default: 'Create AI-powered flashcards and accelerate your learning journey.' },
    twitterImage: { type: String, default: '/images/twitter-image.jpg' },
    favicon: { type: String, default: '/favicon.ico' },
    logoUrl: { type: String, default: '/images/logo.png' },
    robotsTxt: { type: String, default: 'User-agent: *\nAllow: /' }
  },
  lastModified: { type: Date, default: Date.now },
  lastModifiedBy: {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true }
  }
}, {
  timestamps: true,
  collection: 'systemsettings'
});

// Ensure only one settings document exists
SystemSettingsSchema.index({}, { unique: true });

const SystemSettings = mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);

export default SystemSettings;
