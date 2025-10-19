import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GPT-5 utility function using the new responses API
export const createGPT5Response = async (prompt: string, reasoning: 'low' | 'medium' | 'high' = 'medium', verbosity: 'low' | 'medium' | 'high' = 'medium') => {
  try {
    const result = await openaiClient.responses.create({
      model: "gpt-5",
      input: prompt,
      reasoning: { effort: reasoning }
    });
    
    return {
      choices: [{
        message: {
          content: result.output_text
        }
      }]
    };
  } catch (error) {
    console.error('GPT-5 API Error:', error);
    throw error;
  }
};

export default openaiClient; 