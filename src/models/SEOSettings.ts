import mongoose, { Document, Schema } from 'mongoose';

export interface ISEOSettings extends Document {
  siteName: string;
  siteDescription: string;
  defaultTitle: string;
  titleSeparator: string;
  defaultKeywords: string[];
  ogImage: string;
  twitterHandle: string;
  googleAnalyticsId?: string;
  googleSearchConsoleId?: string;
  bingWebmasterToolsId?: string;
  robotsTxt: string;
  sitemapUrl: string;
  canonicalUrl: string;
  hreflangSettings: {
    enabled: boolean;
    defaultLanguage: string;
    languages: {
      code: string;
      name: string;
      url: string;
    }[];
  };
  structuredData: {
    organization: {
      name: string;
      url: string;
      logo: string;
      contactPoint: {
        telephone: string;
        contactType: string;
      };
    };
    website: {
      name: string;
      url: string;
      description: string;
    };
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

const SEOSettingsSchema: Schema = new Schema({
  siteName: {
    type: String,
    required: true,
    trim: true
  },
  siteDescription: {
    type: String,
    required: true,
    trim: true
  },
  defaultTitle: {
    type: String,
    required: true,
    trim: true
  },
  titleSeparator: {
    type: String,
    default: ' | '
  },
  defaultKeywords: [{
    type: String,
    trim: true
  }],
  ogImage: {
    type: String,
    trim: true
  },
  twitterHandle: {
    type: String,
    trim: true
  },
  googleAnalyticsId: {
    type: String,
    trim: true
  },
  googleSearchConsoleId: {
    type: String,
    trim: true
  },
  bingWebmasterToolsId: {
    type: String,
    trim: true
  },
  robotsTxt: {
    type: String,
    default: `User-agent: *
Allow: /

Sitemap: /sitemap.xml`
  },
  sitemapUrl: {
    type: String,
    trim: true
  },
  canonicalUrl: {
    type: String,
    required: true,
    trim: true
  },
  hreflangSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    defaultLanguage: {
      type: String,
      default: 'en'
    },
    languages: [{
      code: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true
      },
      url: {
        type: String,
        required: true
      }
    }]
  },
  structuredData: {
    organization: {
      name: {
        type: String,
        required: true
      },
      url: {
        type: String,
        required: true
      },
      logo: {
        type: String,
        required: true
      },
      contactPoint: {
        telephone: String,
        contactType: {
          type: String,
          default: 'customer service'
        }
      }
    },
    website: {
      name: {
        type: String,
        required: true
      },
      url: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      }
    }
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  lastModifiedBy: {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  }
}, {
  timestamps: true
});

// Pre-save middleware to update lastModified
SEOSettingsSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastModified = new Date();
  }
  next();
});

export default mongoose.model<ISEOSettings>('SEOSettings', SEOSettingsSchema);
