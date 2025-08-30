import { Supadata } from '@supadata/js'
import dotenv from 'dotenv'

dotenv.config()

const apiKey = process.env.SUPADATA_API_KEY
if (!apiKey) {
  throw new Error('SUPADATA_API_KEY is not set in environment variables')
}

export const supadata = new Supadata({ apiKey })
