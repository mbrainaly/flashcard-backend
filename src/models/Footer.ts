import mongoose, { Document, Schema } from 'mongoose'

interface FooterLink {
  id: string
  title: string
  url: string
  order: number
}

interface SocialLink {
  id: string
  platform: string
  url: string
  icon: string
  order: number
}

export interface IFooter extends Document {
  links: FooterLink[]
  socialLinks: SocialLink[]
  bottomText: string
  lastModified: Date
  lastModifiedBy: {
    adminId: mongoose.Types.ObjectId
    name: string
    email: string
  }
  createdAt: Date
  updatedAt: Date
}

const FooterLinkSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  url: { type: String, required: true },
  order: { type: Number, default: 0 }
})

const SocialLinkSchema = new Schema({
  id: { type: String, required: true },
  platform: { type: String, required: true },
  url: { type: String, default: '' },
  icon: { type: String, required: true },
  order: { type: Number, default: 0 }
})

const FooterSchema = new Schema<IFooter>({
  links: [FooterLinkSchema],
  socialLinks: [SocialLinkSchema],
  bottomText: { type: String, default: '' },
  lastModified: { type: Date, default: Date.now },
  lastModifiedBy: {
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin' },
    name: { type: String, default: '' },
    email: { type: String, default: '' }
  }
}, {
  timestamps: true
})

// Ensure only one footer document exists
FooterSchema.index({}, { unique: true })

export default mongoose.model<IFooter>('Footer', FooterSchema)
