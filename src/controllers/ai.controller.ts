import { Request, Response } from 'express';
import { generateFlashcards, analyzeContent } from '../utils/ai';
import Deck from '../models/Deck';
import Card from '../models/Card';
import { initializeCard } from '../utils/spacedRepetition';
import openaiClient, { createGPT5Response } from '../config/openai';
import { supadata } from '../config/supadata';
import User from '../models/User';
import { PLAN_RULES, currentPeriodKey } from '../utils/plan';
import { getPlanRulesForId } from '../utils/getPlanRules'
// Removed old credit system import - using new dynamic system only
import { deductFeatureCredits, refundFeatureCredits } from '../utils/dynamicCredits';
import { CREDIT_COSTS } from '../config/credits';
import { checkAiGenerationLimit, checkDailyAiLimit, checkMonthlyAiLimit } from '../utils/planLimits';

function looksLikeYouTubeUrl(input?: string) {
  if (!input) return false;
  return /(youtube\.com\/.+v=|youtu\.be\/)/i.test(input);
}

async function getTranscriptFromSupadata(urlOrId: string): Promise<string> {
  try {
    let resp: any = await supadata.youtube.transcript({ url: urlOrId, text: true });
    if (!resp && /^[-_a-zA-Z0-9]{11}$/.test(urlOrId)) {
      resp = await supadata.youtube.transcript({ videoId: urlOrId, text: true });
    }
    if (typeof resp === 'string') return resp;
    if (resp?.content && typeof resp.content === 'string') return resp.content;
    if (Array.isArray(resp?.segments)) return resp.segments.map((s: any) => s.text).join(' ');
    return '';
  } catch (e) {
    return '';
  }
}

// @desc    Generate flashcards for a deck
// @route   POST /api/ai/flashcards/generate
// @access  Private
export const generateFlashcardsForDeck = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deckId, topic, content, numberOfCards, difficulty } = req.body;
    console.log('=== AI FLASHCARD GENERATION STARTED ===');
    console.log('Received request:', { deckId, topic, numberOfCards, difficulty });

    // Check AI generation limits before proceeding
    console.log('Checking AI generation limits for flashcards...');
    const aiLimitCheck = await checkAiGenerationLimit(req.user._id);
    console.log('AI limit check result for flashcards:', aiLimitCheck);
    if (!aiLimitCheck.allowed) {
      console.log('AI limit check failed for flashcards, returning 403');
      res.status(403).json({ 
        message: aiLimitCheck.message,
        currentCount: aiLimitCheck.currentCount,
        maxAllowed: aiLimitCheck.maxAllowed === Infinity ? 'unlimited' : aiLimitCheck.maxAllowed
      });
      return;
    }
    console.log('AI limit check passed for flashcards, continuing...');

    const dailyLimitCheck = await checkDailyAiLimit(req.user._id);
    if (!dailyLimitCheck.allowed) {
      res.status(403).json({ 
        message: dailyLimitCheck.message,
        currentCount: dailyLimitCheck.currentCount,
        maxAllowed: dailyLimitCheck.maxAllowed === Infinity ? 'unlimited' : dailyLimitCheck.maxAllowed
      });
      return;
    }

    const monthlyLimitCheck = await checkMonthlyAiLimit(req.user._id);
    if (!monthlyLimitCheck.allowed) {
      res.status(403).json({ 
        message: monthlyLimitCheck.message,
        currentCount: monthlyLimitCheck.currentCount,
        maxAllowed: monthlyLimitCheck.maxAllowed === Infinity ? 'unlimited' : monthlyLimitCheck.maxAllowed
      });
      return;
    }

    // Verify deck exists and user owns it
    const deck = await Deck.findById(deckId);
    if (!deck) {
      console.log('Deck not found:', deckId);
      res.status(404).json({ message: 'Deck not found' });
      return;
    }
    if (deck.owner.toString() !== req.user._id.toString()) {
      console.log('Unauthorized access. User:', req.user._id, 'Deck owner:', deck.owner);
      res.status(403).json({ message: 'Not authorized to modify this deck' });
      return;
    }

    // Charge credits for AI flashcard generation using dynamic system
    console.log('About to deduct AI flashcard credits...');
    const creditResult = await deductFeatureCredits(req.user._id, 'aiFlashcards', CREDIT_COSTS.flashcardGeneration);
    if (!creditResult.success) {
      console.log('AI flashcard credit deduction failed:', creditResult.message);
      res.status(403).json({ 
        success: false, 
        message: creditResult.message || 'Insufficient AI flashcard credits. Please upgrade your plan.' 
      });
      return;
    }
    console.log('AI flashcard credit deduction successful. Remaining:', creditResult.remaining);

    // Generate flashcards using AI
    console.log('Generating flashcards with OpenAI...');
    const generatedCards = await generateFlashcards({
      topic,
      content,
      numberOfCards,
      difficulty,
    });
    console.log('Generated cards:', generatedCards.length);

    // Create cards in the database
    console.log('Creating cards in database...');
    const cardPromises = generatedCards.map(async (cardData) => {
      const srsValues = initializeCard();
      return Card.create({
        deck: deckId,
        createdBy: req.user._id,
        ...cardData,
        ...srsValues,
      });
    });

    const cards = await Promise.all(cardPromises);
    console.log('Created cards in database:', cards.length);

    // Update deck card count
    deck.totalCards += cards.length;
    await deck.save();

    res.status(201).json(cards);
  } catch (error) {
    console.error('Error generating flashcards:', error);
    // Attempt to refund credits on failure
    try { 
      await refundFeatureCredits(req.user._id, 'aiFlashcards', CREDIT_COSTS.flashcardGeneration);
      console.log('AI flashcard credits refunded due to flashcard generation failure');
    } catch (refundError) {
      console.error('Failed to refund AI flashcard credits:', refundError);
    }
    res.status(500).json({ message: 'Error generating flashcards', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// @desc    Analyze content for flashcard generation
// @route   POST /api/ai/analyze-content
// @access  Private
export const analyzeContentForFlashcards = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ message: 'Content is required' });
      return;
    }

    const analysis = await analyzeContent(content);
    res.status(200).json(analysis);
  } catch (error) {
    console.error('Error analyzing content:', error);
    res.status(500).json({ message: 'Error analyzing content' });
  }
};

// @desc    Evaluate exam answer
// @route   POST /api/ai/evaluate-answer
// @access  Private
export const evaluateAnswer = async (req: Request, res: Response): Promise<void> => {
  try {
    // Plan gating for AI Study Assistant
    const user = await User.findById(req.user._id)
    const planId = user?.subscription?.plan || 'basic'
    console.log('User plan ID:', planId, 'User subscription:', user?.subscription)
    
    const rules = await getPlanRulesForId(planId)
    console.log('Plan rules:', rules)
    
    if (!rules || !rules.allowAIStudyAssistant) {
      res.status(403).json({ success: false, message: 'Your plan does not include AI Study Assistant' })
      return
    }

    const { cardId, answer, correctAnswer } = req.body;

    const prompt = `
      You are an AI tutor evaluating a student's answer. Please analyze the following:

      Correct answer: "${correctAnswer}"
      Student's answer: "${answer}"

      Provide a detailed evaluation including:
      1. A score from 0 to 5 based on accuracy and completeness
      2. A clear explanation of what was good and what needs improvement
      3. Specific suggestions for better understanding

      Format your response as a JSON object with the following structure:
      {
        "score": number,
        "explanation": string,
        "suggestions": string[]
      }
    `;

    const feedbackPrompt = `You are a helpful AI tutor that provides detailed feedback on student answers.

${prompt}`;

    const completion = await createGPT5Response(feedbackPrompt, 'high', 'medium');

    const evaluation = completion.choices[0].message.content 
      ? JSON.parse(completion.choices[0].message.content) 
      : { error: "No content returned" };
    res.status(200).json(evaluation);
  } catch (error) {
    console.error('Error evaluating answer:', error);
    res.status(500).json({ message: 'Failed to evaluate answer' });
  }
};

// @desc    Generate quiz question
// @route   POST /api/ai/quiz/generate
// @access  Private
export const generateQuizQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cardId, front, back } = req.body;

    const prompt = `
      Generate a multiple choice question based on this flashcard:
      Front: ${front}
      Back: ${back}

      Create:
      1. A clear question
      2. Four possible answers (one correct, three plausible but incorrect)
      3. The index of the correct answer (0-3)

      Format your response as a JSON object with the following structure:
      {
        "question": string,
        "options": string[],
        "correctIndex": number
      }

      Make sure the options are:
      - Clearly distinct from each other
      - All plausible but only one correct
      - Similar in length and style
      - Not obviously wrong or silly
    `;

    const validationPrompt = `You are a helpful AI tutor that generates engaging multiple choice questions.

${prompt}`;

    const completion = await createGPT5Response(validationPrompt, 'high', 'medium');

    const quizQuestion = completion.choices[0].message.content 
      ? JSON.parse(completion.choices[0].message.content) 
      : { error: "No content returned" };
    res.status(200).json(quizQuestion);
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ message: 'Failed to generate quiz question' });
  }
};

export const explainFlashcard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { front, back } = req.body

    if (!front || !back) {
      res.status(400).json({
        success: false,
        message: 'Front and back content are required',
      })
      return
    }

    const prompt = `Please explain the relationship between this flashcard's question and answer:
    
Question: ${front}
Answer: ${back}

Provide a clear, concise explanation that helps understand why this answer is correct and how it relates to the question. Include any relevant context or concepts that would help someone understand this better.`

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI tutor explaining the relationship between flashcard questions and answers. Keep explanations clear, concise, and focused on helping the student understand the connection between the question and answer.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 250,
      temperature: 0.7,
    })

    const explanation = response.choices[0]?.message?.content || 'No explanation available.'

    res.status(200).json({
      success: true,
      explanation,
    })
  } catch (error) {
    console.error('Error in explainFlashcard:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to generate explanation',
    })
  }
}

// @desc    Analyze content for quiz generation
// @route   POST /api/ai/analyze-quiz-content
// @access  Private
export const analyzeQuizContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content } = req.body;

    // If content is a YouTube URL, resolve to transcript via Supadata
    let resolvedContent = content;
    if (looksLikeYouTubeUrl(content)) {
      const t = await getTranscriptFromSupadata(content);
      if (t) resolvedContent = t;
    }

    const prompt = `
      Analyze the following content for quiz generation:

      ${resolvedContent}

      Provide:
      1. A list of key concepts from the content
      2. Suggested topics for quiz questions
      3. Recommended difficulty level (beginner, intermediate, or advanced)
      4. Estimated number of meaningful quiz questions that can be generated

      Format your response as a JSON object with the following structure:
      {
        "keyConcepts": string[],
        "suggestedTopics": string[],
        "recommendedDifficulty": string,
        "estimatedQuestions": number
      }

      Guidelines:
      - Extract 3-5 key concepts
      - Suggest 4-6 specific topics for questions
      - Base difficulty on content complexity
      - Estimate questions based on content depth
    `;

    const analysisPrompt = `You are an expert content analyzer specializing in educational assessment.

${prompt}`;

    const completion = await createGPT5Response(analysisPrompt, 'high', 'medium');

    const analysis = completion.choices[0].message.content 
      ? JSON.parse(completion.choices[0].message.content) 
      : { error: "No content returned" };
    res.status(200).json(analysis);
  } catch (error) {
    console.error('Error analyzing quiz content:', error);
    res.status(500).json({ message: 'Failed to analyze content' });
  }
};

// @desc    Generate a complete quiz
// @route   POST /api/ai/generate-quiz-complete
// @access  Private
export const generateQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, numberOfQuestions, difficulty, questionTypes } = req.body;
    console.log('=== AI QUIZ GENERATION STARTED ===');
    console.log('Request params:', { numberOfQuestions, difficulty, questionTypes });

    // Check AI generation limits before proceeding
    console.log('Checking AI generation limits for quiz...');
    const aiLimitCheck = await checkAiGenerationLimit(req.user._id);
    console.log('AI limit check result for quiz:', aiLimitCheck);
    if (!aiLimitCheck.allowed) {
      console.log('AI limit check failed for quiz, returning 403');
      res.status(403).json({ 
        success: false,
        message: aiLimitCheck.message,
        currentCount: aiLimitCheck.currentCount,
        maxAllowed: aiLimitCheck.maxAllowed === Infinity ? 'unlimited' : aiLimitCheck.maxAllowed
      });
      return;
    }
    console.log('AI limit check passed for quiz, continuing...');

    const dailyLimitCheck = await checkDailyAiLimit(req.user._id);
    if (!dailyLimitCheck.allowed) {
      res.status(403).json({ 
        success: false,
        message: dailyLimitCheck.message,
        currentCount: dailyLimitCheck.currentCount,
        maxAllowed: dailyLimitCheck.maxAllowed === Infinity ? 'unlimited' : dailyLimitCheck.maxAllowed
      });
      return;
    }

    const monthlyLimitCheck = await checkMonthlyAiLimit(req.user._id);
    if (!monthlyLimitCheck.allowed) {
      res.status(403).json({ 
        success: false,
        message: monthlyLimitCheck.message,
        currentCount: monthlyLimitCheck.currentCount,
        maxAllowed: monthlyLimitCheck.maxAllowed === Infinity ? 'unlimited' : monthlyLimitCheck.maxAllowed
      });
      return;
    }

    // Charge credits for AI quiz generation using dynamic system
    console.log('About to deduct AI quiz credits...');
    const creditResult = await deductFeatureCredits(req.user._id, 'aiQuizzes', CREDIT_COSTS.quizGeneration);
    if (!creditResult.success) {
      console.log('AI quiz credit deduction failed:', creditResult.message);
      res.status(403).json({ 
        success: false, 
        message: creditResult.message || 'Insufficient AI quiz credits. Please upgrade your plan.' 
      });
      return;
    }
    console.log('AI quiz credit deduction successful. Remaining:', creditResult.remaining);

    // Allow passing a YouTube URL directly
    let resolvedContent = content;
    if (looksLikeYouTubeUrl(content)) {
      const t = await getTranscriptFromSupadata(content);
      if (t) resolvedContent = t;
    }

    const prompt = `
      Generate a quiz with ${numberOfQuestions} questions based on this content:

      ${resolvedContent}

      CRITICAL REQUIREMENTS:
      - Overall difficulty level: ${difficulty}
      - ONLY generate questions of these types: ${questionTypes.join(', ')}
      - ${questionTypes.length === 1 ? `ALL ${numberOfQuestions} questions MUST be of type "${questionTypes[0]}"` : `Distribute questions evenly across: ${questionTypes.join(', ')}`}
      - DO NOT generate any other question types beyond: ${questionTypes.join(', ')}
      
      Each question should have:
      - Clear and concise wording
      - Brief explanation of the correct answer
      
      Type-specific formatting (FOLLOW EXACTLY):
      - multiple-choice: include "options" (array of 4 strings) and "correctOptionIndex" (0-3)
      - true-false: set "options" to ["True", "False"] and "correctOptionIndex" (0 for True, 1 for False)
      - short-answer: include "answer" (string) and set "options" to [answer] and "correctOptionIndex" to 0
      
      Additional requirements:
      - Questions should cover different aspects of the content
      - Distribute difficulty evenly
      - Avoid repetitive or overlapping questions

      Format your response strictly as JSON object with this structure:
      {
        "questions": [
          {
            "question": string,
            "options": string[],
            "correctOptionIndex": number,
            "answer": string | null,
            "explanation": string,
            "type": "${questionTypes.length === 1 ? questionTypes[0] : 'multiple-choice | true-false | short-answer'}",
            "difficulty": "beginner" | "intermediate" | "advanced"
          }
        ]
      }
    `;

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert quiz creator specializing in educational assessment.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const rawQuiz = completion.choices[0].message.content 
      ? JSON.parse(completion.choices[0].message.content) 
      : { error: "No content returned" };

    // Normalize questions to match frontend expectations (same logic as quiz.controller.ts)
    if (rawQuiz.questions && Array.isArray(rawQuiz.questions)) {
      const normalizedQuestions = rawQuiz.questions.map((q: any) => {
        const rawType = (q.type || '').toString().toLowerCase().replace(/\s+/g, '-').replace('true/false', 'true-false')
        const type: 'multiple-choice' | 'true-false' | 'short-answer' =
          rawType === 'true-false' ? 'true-false' : rawType === 'short-answer' ? 'short-answer' : 'multiple-choice'

        if (type === 'true-false') {
          const correct = typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex :
            (typeof q.correctAnswer === 'number' ? q.correctAnswer : (String(q.answer || '').toLowerCase().startsWith('t') ? 0 : 1))
          return {
            question: String(q.question || 'Untitled question'),
            options: ['True', 'False'],
            correctOptionIndex: correct === 0 ? 0 : 1,
            explanation: String(q.explanation || ''),
            type,
            difficulty: ['beginner','intermediate','advanced'].includes((q.difficulty||'').toString()) ? q.difficulty : 'intermediate',
          }
        }

        if (type === 'short-answer') {
          const answer = String(q.answer || (Array.isArray(q.options) && q.options.length > 0 ? q.options[0] : '')).trim()
          return {
            question: String(q.question || 'Untitled question'),
            options: [answer],
            correctOptionIndex: 0,
            explanation: String(q.explanation || ''),
            type,
            difficulty: ['beginner','intermediate','advanced'].includes((q.difficulty||'').toString()) ? q.difficulty : 'intermediate',
          }
        }

        // multiple-choice default
        const options = Array.isArray(q.options) ? q.options.map((o: any) => String(o ?? '')) : []
        const nonEmptyOptions = options.filter((o: string) => o.trim() !== '')
        return {
          question: String(q.question || 'Untitled question'),
          options: nonEmptyOptions.length >= 2 ? nonEmptyOptions : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
          correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex :
            (typeof q.correctAnswer === 'number' ? q.correctAnswer : 0),
          explanation: String(q.explanation || ''),
          type,
          difficulty: ['beginner','intermediate','advanced'].includes((q.difficulty||'').toString()) ? q.difficulty : 'intermediate',
        }
      })

      rawQuiz.questions = normalizedQuestions
    }

    res.status(200).json(rawQuiz);

    // Increment usage counter after success
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'subscription.usage.monthKey': currentPeriodKey() },
      $inc: { 'subscription.usage.quizzesGenerated': 1 },
    })
  } catch (error) {
    console.error('Error generating quiz:', error);
    // Attempt to refund AI quiz credits on failure
    try { 
      await refundFeatureCredits(req.user._id, 'aiQuizzes', CREDIT_COSTS.quizGeneration);
      console.log('AI quiz credits refunded due to generation failure');
    } catch (refundError) {
      console.error('Failed to refund AI quiz credits:', refundError);
    }
    res.status(500).json({ message: 'Failed to generate quiz' });
  }
};

// @desc    Answer questions about notes
// @route   POST /api/ai/answer-question
// @access  Private
export const answerQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== AI ASSISTANT (ANSWER QUESTION) STARTED ===');
    
    // Check AI generation limits before proceeding
    console.log('Checking AI generation limits for assistant...');
    const aiLimitCheck = await checkAiGenerationLimit(req.user._id);
    console.log('AI limit check result for assistant:', aiLimitCheck);
    if (!aiLimitCheck.allowed) {
      console.log('AI limit check failed for assistant, returning 403');
      res.status(403).json({ 
        success: false,
        message: aiLimitCheck.message,
        currentCount: aiLimitCheck.currentCount,
        maxAllowed: aiLimitCheck.maxAllowed
      });
      return;
    }
    console.log('AI limit check passed for assistant, continuing...');

    const dailyLimitCheck = await checkDailyAiLimit(req.user._id);
    if (!dailyLimitCheck.allowed) {
      res.status(403).json({ 
        success: false,
        message: dailyLimitCheck.message,
        currentCount: dailyLimitCheck.currentCount,
        maxAllowed: dailyLimitCheck.maxAllowed
      });
      return;
    }

    const monthlyLimitCheck = await checkMonthlyAiLimit(req.user._id);
    if (!monthlyLimitCheck.allowed) {
      res.status(403).json({ 
        success: false,
        message: monthlyLimitCheck.message,
        currentCount: monthlyLimitCheck.currentCount,
        maxAllowed: monthlyLimitCheck.maxAllowed
      });
      return;
    }

    const { question, context } = req.body

    if (!question || !context) {
      res.status(400).json({
        success: false,
        message: 'Question and context are required'
      })
      return
    }

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are a helpful study assistant. Your task is to answer questions about the provided study notes.
          
Format your response using semantic HTML with the following structure:
1. Start with a brief direct answer in a <p> tag
2. Use <h2> tags for main sections (if needed)
3. Use <p> tags for detailed explanations
4. Use <blockquote> tags for direct quotes from the notes
5. Use <strong> tags for important terms or concepts
6. Use <ul> and <li> tags for lists
7. If timestamps [XX:XX] are found, include them in the relevant sections
8. Keep the answer well-structured and easy to read
9. Use proper spacing and formatting
10. Ensure all HTML tags are properly closed

Example format:
<p>Brief answer...</p>
<h2>Detailed Explanation</h2>
<p>More detailed information...</p>
<blockquote>Direct quote from notes...</blockquote>
<h2>Key Points</h2>
<ul>
  <li>Point 1...</li>
  <li>Point 2...</li>
</ul>`
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const answer = response.choices[0].message.content || ''

    res.status(200).json({
      success: true,
      answer
    })

    // Deduct credits and update usage after successful response
    console.log('About to deduct credits for AI assistant...');
    console.log('Credit cost:', CREDIT_COSTS.aiAssistant, 'User ID:', req.user._id);
    try {
      const creditResult = await deductFeatureCredits(req.user._id, 'aiAssistant', CREDIT_COSTS.aiAssistant);
      if (creditResult.success) {
        console.log('AI assistant credit deduction successful. Remaining:', creditResult.remaining);
        await User.findByIdAndUpdate(req.user._id, {
          $set: { 'subscription.usage.monthKey': currentPeriodKey() },
          $inc: { 'subscription.usage.aiGenerations': 1 },
        });
      } else {
        console.log('AI assistant credit deduction failed:', creditResult.message);
      }
    } catch (updateError) {
      console.error('Error updating usage after answer question:', updateError);
    }
  } catch (error) {
    console.error('Error answering question:', error)
    // Attempt to refund credits on failure
    try { 
      await refundFeatureCredits(req.user._id, 'aiAssistant', CREDIT_COSTS.aiAssistant);
      console.log('AI assistant credits refunded due to error');
    } catch (refundError) {
      console.error('Failed to refund AI assistant credits:', refundError);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to answer question'
    })
  }
}

// @desc    Explain a concept
// @route   POST /api/ai/explain-concept
// @access  Private
export const explainConcept = async (req: Request, res: Response): Promise<void> => {
  try {
    // Plan gating for AI Study Assistant
    const user = await User.findById(req.user._id)
    const planId = user?.subscription?.plan || 'basic'
    console.log('Concept explanation - User plan ID:', planId, 'User subscription:', user?.subscription)
    
    const rules = await getPlanRulesForId(planId)
    console.log('Concept explanation - Plan rules:', rules)
    
    if (!rules || !rules.allowAIStudyAssistant) {
      res.status(403).json({ success: false, message: 'Your plan does not include AI Study Assistant' })
      return
    }

    const { concept, subject } = req.body

    if (!concept) {
      res.status(400).json({
        success: false,
        message: 'Concept is required'
      })
      return
    }

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert tutor specializing in ${subject || 'various subjects'}. 
Your task is to explain concepts clearly and thoroughly.

Format your explanation using semantic HTML with the following structure:
1. Start with a brief definition in a <p> tag
2. Use <h2> tags for main sections:
   - Overview
   - Key Components
   - Examples
   - Real-world Applications
   - Common Misconceptions (if any)
3. Use <strong> tags for important terms
4. Use <ul> and <li> tags for lists
5. Use <blockquote> tags for important points or memorable quotes
6. Use <code> tags for formulas or technical terms
7. Keep explanations clear and engaging
8. Use analogies when helpful
9. Include examples that demonstrate practical applications
10. Address common misconceptions if relevant

Example format:
<p>Brief definition...</p>
<h2>Overview</h2>
<p>Detailed explanation...</p>
<h2>Key Components</h2>
<ul>
  <li>Component 1...</li>
  <li>Component 2...</li>
</ul>
<h2>Examples</h2>
<p>Example explanation...</p>
<blockquote>Important point or memorable explanation...</blockquote>`
        },
        {
          role: 'user',
          content: `Please explain this concept: ${concept}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const explanation = response.choices[0].message.content || ''

    res.status(200).json({
      success: true,
      explanation
    })
  } catch (error) {
    console.error('Error explaining concept:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to explain concept'
    })
  }
} 