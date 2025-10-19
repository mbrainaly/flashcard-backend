import genAI from '../config/gemini';
import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import bedrockClient from '../config/bedrock';

interface GenerateFlashcardsInput {
  topic: string;
  content?: string;
  numberOfCards?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

interface GeneratedCard {
  front: string;
  back: string;
  hints?: string[];
  examples?: string[];
}

interface ExamEvaluation {
  score: number;
  explanation: string;
  suggestions: string[];
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

const FLASHCARD_SYSTEM_PROMPT = `You are an expert educator and flashcard creator. Your task is to create effective flashcards that follow these principles:
1. Clear and concise content
2. One main concept per card
3. Precise language
4. Include relevant examples when helpful
5. Add hints for complex topics
6. Ensure accuracy of information`;

// Gemini function for flashcard generation only
async function invokeGemini(systemPrompt: string, userPrompt: string) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const prompt = `${systemPrompt}\n\n${userPrompt}`;

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 2000,
    }
  });

  const response = result.response;
  return response.text();
}

// Claude function for everything else
async function invokeClaude(systemPrompt: string, userPrompt: string) {
  const command = new InvokeModelCommand({
    modelId: "global.anthropic.claude-sonnet-4-20250514-v1:0",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4000,
      temperature: 0.7,
      top_p: 0.9,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${systemPrompt}\n\n${userPrompt}`
            }
          ]
        }
      ]
    }),
    contentType: "application/json",
    accept: "application/json",
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
}

export async function generateFlashcards({
  topic,
  content,
  numberOfCards = 5,
  difficulty = 'intermediate',
}: GenerateFlashcardsInput): Promise<GeneratedCard[]> {
  try {
    console.log('Starting flashcard generation with Gemini...');
    console.log('Parameters:', { topic, numberOfCards, difficulty });

    const userPrompt = `Create ${numberOfCards} flashcards about "${topic}" at ${difficulty} level.
${content ? `Use this content as reference: ${content}` : ''}

Format each flashcard as a JSON object with these fields:
- front: The question or prompt
- back: The answer or explanation
- hints: (optional) Array of helpful hints
- examples: (optional) Array of relevant examples

Return the flashcards as a JSON array.`;

    console.log('Sending request to Gemini...');
    const completion = await invokeGemini(FLASHCARD_SYSTEM_PROMPT, userPrompt);
    console.log('Received response from Gemini');

    if (!completion) {
      console.error('No content in Gemini response');
      throw new Error('No content generated');
    }

    console.log('Parsing Gemini response...');
    try {
      // Extract JSON array from the response
      const jsonMatch = completion.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      const parsedContent = JSON.parse(jsonMatch[0]);
      console.log('Successfully parsed response');
      return parsedContent;
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', completion);
      console.error('Parse error:', parseError);
      throw new Error('Failed to parse generated content');
    }
  } catch (error) {
    console.error('Error in generateFlashcards:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

export async function analyzeContent(content: string) {
  try {
    const systemPrompt = 'You are an expert content analyzer. Analyze the given content and extract key concepts, suggested flashcard topics, and difficulty level.';
    const userPrompt = `Analyze this content and provide:
1. Key concepts (as an array)
2. Suggested flashcard topics (as an array)
3. Recommended difficulty level
4. Estimated number of flashcards needed

Return the analysis as a JSON object with these exact field names:
{
  "keyConcepts": ["concept1", "concept2"],
  "suggestedTopics": ["topic1", "topic2"],
  "recommendedDifficulty": "beginner|intermediate|advanced",
  "estimatedCards": number
}

Content: ${content}`;

    console.log('Analyzing content with Claude:', content);
    const completion = await invokeClaude(systemPrompt, userPrompt);
    console.log('Received analysis response from Claude:', completion);
    
    if (!completion) {
      throw new Error('No analysis generated');
    }

    // Extract JSON object from the response
    const jsonMatch = completion.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error analyzing content:', error);
    throw new Error('Failed to analyze content');
  }
}

// PDF processing with Claude Sonnet 4 (for notes generation)
export async function processPDFWithClaude(fileBuffer: Buffer, mimeType: string, prompt: string = 'Extract and summarize the key content from this document for note-taking purposes.') {
  try {
    console.log('Processing PDF with Claude Sonnet 4...');
    
    const command = new InvokeModelCommand({
      modelId: "global.anthropic.claude-sonnet-4-20250514-v1:0",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
        temperature: 0.7,
        top_p: 0.9,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are an expert document analyzer. Your task is to extract and summarize key content from documents for note-taking purposes.\n\n${prompt}`
              },
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: fileBuffer.toString('base64')
                }
              }
            ]
          }
        ]
      }),
      contentType: "application/json",
      accept: "application/json",
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log('Successfully processed PDF with Claude Sonnet 4');
    return responseBody.content[0].text;
  } catch (error) {
    console.error('Error processing PDF with Claude:', error);
    throw new Error('Failed to process PDF with Claude');
  }
}

// Notes generation with Claude (for structured HTML notes)
export async function generateNotesFromContent(content: string, topic?: string) {
  try {
    console.log('Generating notes with Claude...');
    
    const systemPrompt = `You are an expert note-taker and educator. Create well-structured study notes using HTML formatting.

Your response must follow these strict rules:
1. Start with an <h1> tag containing a descriptive title
2. Use semantic HTML elements properly:
   - <h1> for the main title
   - <h2> for section headings
   - <p> for paragraphs
   - <ul> and <li> for bullet points
   - <strong> for important terms
   - <table>, <tr>, and <td> for tables if needed
3. Do not include any markdown or non-HTML formatting
4. Do not include any text outside of HTML tags
5. Do not include DOCTYPE, XML declarations, or HTML comments
6. Do not include <html>, <head>, or <body> tags
7. Ensure all HTML tags are properly closed
8. Use only the specified HTML elements - no other tags allowed
9. Create a clear hierarchy of information with main concepts and supporting details`;

    const userPrompt = `Create comprehensive study notes from the following content${topic ? ` about "${topic}"` : ''}:

${content}

Please structure the notes with:
1. Start with a clear title using <h1> tags
2. Use <h2> tags for main sections
3. Use <p> tags for paragraphs
4. Use <ul> and <li> tags for bullet points
5. Use <strong> tags for important terms
6. Include key concepts, definitions, and examples
7. Organize the content in a logical, hierarchical structure
8. Add a summary section at the beginning
9. Highlight key takeaways at the end

Format the entire response in clean HTML without any markdown or other formatting.`;

    const completion = await invokeClaude(systemPrompt, userPrompt);
    console.log('Successfully generated notes with Claude');

    if (!completion) {
      throw new Error('No notes generated');
    }

    // Additional cleanup to ensure proper HTML structure
    let cleanedNotes = completion;
    
    // Ensure it starts with an h1 tag
    if (!cleanedNotes.startsWith('<h1>') && !cleanedNotes.startsWith('<h1 ')) {
      cleanedNotes = `<h1>Study Notes${topic ? ` - ${topic}` : ''}</h1>${cleanedNotes}`;
    }

    // Ensure it's wrapped in a valid HTML structure if needed
    if (!/^<[^>]+>/.test(cleanedNotes)) {
      cleanedNotes = `<div>${cleanedNotes}</div>`;
    }

    return cleanedNotes;
  } catch (error) {
    console.error('Error generating notes:', error);
    throw new Error('Failed to generate notes');
  }
}