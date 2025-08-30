import mongoose, { Schema, Document } from 'mongoose'

export interface IPlan extends Document {
  id: string; // basic | pro | team
  name: string;
  price: number;
  monthlyCredits: number;
  allowDocuments: boolean;
  allowYoutubeAnalyze: boolean;
  allowAIFlashcards: boolean;
  allowAIStudyAssistant: boolean;
  monthlyQuizLimit: number | null;
  monthlyNotesLimit: number | null;
  features: string[];
}

const planSchema = new Schema<IPlan>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  monthlyCredits: { type: Number, required: true },
  allowDocuments: { type: Boolean, default: false },
  allowYoutubeAnalyze: { type: Boolean, default: false },
  allowAIFlashcards: { type: Boolean, default: false },
  allowAIStudyAssistant: { type: Boolean, default: false },
  monthlyQuizLimit: { type: Number, default: null },
  monthlyNotesLimit: { type: Number, default: null },
  features: [{ type: String }],
})

export default mongoose.model<IPlan>('Plan', planSchema)


