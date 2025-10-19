import { Request, Response } from 'express'
import { YoutubeTranscript } from 'youtube-transcript'
import openaiClient, { createGPT5Response } from '../config/openai'
import User from '../models/User'
import { PLAN_RULES, currentPeriodKey } from '../utils/plan'
import { getPlanRulesForId } from '../utils/getPlanRules'
// Removed old credit system import - using new dynamic system only
import { deductFeatureCredits, refundFeatureCredits } from '../utils/dynamicCredits'
import { CREDIT_COSTS } from '../config/credits'
import { Note } from '../models'
import ytdl from 'ytdl-core'
import { extractTextFromFile } from '../utils/fileProcessing'
import { supadata } from '../config/supadata'
import { checkAiGenerationLimit, checkDailyAiLimit, checkMonthlyAiLimit } from '../utils/planLimits'

// Helper: extract YouTube video ID from multiple URL formats
function extractYouTubeId(input: string): string | null {
  // Supports: watch?v=, youtu.be/, embed/, shorts/, live/
  const patterns = [
    /(?:v=|\/)([a-zA-Z0-9_-]{11})(?:[&?#].*)?$/, // generic capture of 11-char ID
    /youtu\.be\/(.{11})/,
  ]
  for (const rx of patterns) {
    const m = input.match(rx)
    if (m && m[1]) return m[1]
  }
  return null
}

// Parse YouTube timedtext JSON3 into string with timestamps
function parseTimedTextJson3(json: any): string {
  if (!json || !Array.isArray(json.events)) return ''
  const lines: string[] = []
  for (const ev of json.events) {
    const startMs = ev.tStartMs ?? 0
    const minutes = Math.floor(startMs / 1000 / 60)
    const seconds = Math.floor((startMs / 1000) % 60)
    const timestamp = `[${minutes}:${seconds.toString().padStart(2, '0')}]`
    const segs = ev.segs?.map((s: any) => s.utf8).join('') || ''
    const text = segs.replace(/\n/g, ' ').trim()
    if (text) {
      lines.push(`${timestamp} ${text}`)
    }
  }
  return lines.join('\n')
}

async function fetchTimedTextTranscript(videoId: string, langCodes: string[]): Promise<string> {
  // First, list available tracks to discover exact lang+kind
  try {
    const listResp = await fetch(`https://www.youtube.com/api/timedtext?type=list&v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const xml = await listResp.text()
    // Try to find preferred tracks
    const trackRegex = /<track\s+[^>]*lang_code="([^"]+)"[^>]*?(?:kind="([^"]+)")?[^>]*>/g
    const tracks: { lang: string; kind?: string }[] = []
    let m: RegExpExecArray | null
    while ((m = trackRegex.exec(xml)) !== null) {
      tracks.push({ lang: m[1], kind: m[2] })
    }

    // Choose the best track
    const preferred = tracks.find(t => langCodes.includes(t.lang)) || tracks[0]
    if (preferred) {
      const query = new URLSearchParams({ v: videoId, fmt: 'json3', lang: preferred.lang })
      if (preferred.kind) query.set('kind', preferred.kind)
      const ttResp = await fetch(`https://www.youtube.com/api/timedtext?${query.toString()}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      if (ttResp.ok) {
        const data = await ttResp.json().catch(() => null)
        const text = parseTimedTextJson3(data)
        if (text) return text
      }
    }
  } catch (_) {
    // ignore and proceed to direct attempts
  }

  // Direct attempts with common combinations (including auto-generated kind=asr)
  for (const lang of langCodes) {
    for (const kind of [undefined, 'asr'] as const) {
      const query = new URLSearchParams({ v: videoId, fmt: 'json3', lang })
      if (kind) query.set('kind', kind)
      try {
        const resp = await fetch(`https://www.youtube.com/api/timedtext?${query.toString()}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        if (!resp.ok) continue
        const data = await resp.json().catch(() => null)
        const text = parseTimedTextJson3(data)
        if (text) return text
      } catch (_) {
        // try next
      }
    }
  }

  // Final fallback: use ytdl-core to get player_response and caption tracks
  try {
    const info = await ytdl.getInfo(videoId)
    const tracks = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
    if (Array.isArray(tracks) && tracks.length > 0) {
      // Prefer English variants
      const preferred = tracks.find((t: any) => /^(en|en-GB|en-US)/i.test(t.languageCode)) || tracks[0]
      if (preferred?.baseUrl) {
        const url = `${preferred.baseUrl}&fmt=json3`
        const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (resp.ok) {
          const data = await resp.json().catch(() => null)
          const text = parseTimedTextJson3(data)
          if (text) return text
        }
      }
    }
  } catch (_) {
    // ignore
  }

  return ''
}

// Helper: try fetching transcript with fallbacks
async function fetchTranscriptWithFallback(videoId: string, originalUrl: string): Promise<string> {
  // 0) Supadata direct transcript (if available)
  try {
    // Try with URL first
    let sd: any = await supadata.youtube.transcript({ url: originalUrl, text: true })
    // If nothing, try with videoId
    if (!sd) {
      sd = await supadata.youtube.transcript({ videoId, text: true })
    }

    let sdText = ''
    if (typeof sd === 'string') {
      sdText = sd
    } else if (sd && typeof sd.content === 'string') {
      sdText = sd.content
    } else if (sd && Array.isArray(sd.segments)) {
      sdText = sd.segments.map((s: any) => s.text).join(' ')
    }

    if (sdText && sdText.trim().length > 0) {
      return sdText
    }
  } catch (e) {
    console.warn('Supadata transcript failed, falling back:', (e as Error).message)
  }

  // Try default, then preferred English variants
  const preferredLangs = ['en', 'en-US', 'en-GB']

  // 1) Library-based approach first
  for (const lang of [undefined, ...preferredLangs] as (string | undefined)[]) {
    try {
      const resp = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined)
      const text = resp
        .map(item => `[${Math.floor(item.offset / 1000 / 60)}:${Math.floor((item.offset / 1000) % 60).toString().padStart(2, '0')}] ${item.text}`)
        .join('\n')
      if (text && text.trim().length > 0) return text
    } catch (e) {
      // try next language
    }
  }

  // 2) Fallback to YouTube timedtext endpoint (supports auto-generated captions)
  const tt = await fetchTimedTextTranscript(videoId, preferredLangs)
  if (tt && tt.trim().length > 0) return tt

  throw new Error('No transcript available after language fallbacks')
}

// @desc    Get homework help
// @route   POST /api/ai/homework-help
// @access  Private
export const getHomeworkHelp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject, question } = req.body
    let fileContent = ''

    if (!subject || !question) {
      res.status(400).json({
        success: false,
        message: 'Subject and question are required'
      })
      return
    }

    // Check AI generation limits before proceeding
    const aiLimitCheck = await checkAiGenerationLimit(req.user._id);
    if (!aiLimitCheck.allowed) {
      res.status(403).json({ 
        success: false,
        message: aiLimitCheck.message,
        currentCount: aiLimitCheck.currentCount,
        maxAllowed: aiLimitCheck.maxAllowed === Infinity ? 'unlimited' : aiLimitCheck.maxAllowed
      });
      return;
    }

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

    // Process uploaded file if present
    if (req.file) {
      try {
        fileContent = await extractTextFromFile(req.file)
      } catch (error) {
        console.error('Error processing file:', error)
        res.status(400).json({
          success: false,
          message: 'Failed to process uploaded file'
        })
        return
      }
    }

    const notesPrompt = `You are an expert tutor helping students with their homework. You specialize in ${subject}.
          
Provide detailed, step-by-step solutions that:
1. Break down complex problems into manageable parts
2. Explain the reasoning behind each step
3. Include relevant formulas, theories, or concepts
4. Provide examples when helpful
5. Highlight key learning points
6. Suggest additional practice or resources

Format your response in clear HTML with:
- Main points in <h3> tags
- Steps in <ol> or <ul> tags
- Important concepts in <strong> tags
- Formulas in <code> tags
- Examples in <blockquote> tags
- References or resources in <aside> tags

Keep explanations clear and educational, encouraging understanding rather than just providing answers.

Question: ${question}
${fileContent ? `\nAdditional Context:\n${fileContent}` : ''}`;

    const response = await createGPT5Response(notesPrompt, 'high', 'high')

    const answer = response.choices[0].message.content || ''

    res.status(200).json({
      success: true,
      answer
    })
  } catch (error) {
    console.error('Error getting homework help:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get homework help'
    })
  }
}

export const generateNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, type } = req.body;
    console.log('=== NOTES GENERATION STARTED ===');
    console.log('Request body:', { content: content?.substring(0, 100) + '...', type });
    
    // Note: We'll check and deduct credits later in the function using the dynamic credit system
    console.log('Received request:', { type, content });

    if (!content) {
      res.status(400).json({ 
        success: false, 
        message: 'Content is required' 
      });
      return;
    }

    // Charge credits for AI notes generation using dynamic system (moved to beginning)
    console.log('About to deduct AI notes credits...');
    const creditResult = await deductFeatureCredits(req.user._id, 'aiNotes', CREDIT_COSTS.notesAnalysis);
    if (!creditResult.success) {
      console.log('AI notes credit deduction failed:', creditResult.message);
      res.status(403).json({ 
        success: false, 
        message: creditResult.message || 'Insufficient AI notes credits. Please upgrade your plan.' 
      });
      return;
    }
    console.log('AI notes credit deduction successful. Remaining:', creditResult.remaining);

    // Construct the prompt based on content type
    let prompt = '';
    let transcript = '';
    
    switch (type) {
      case 'prompt':
        prompt = `Generate detailed study notes about: ${content}`;
        break;
      case 'content':
        prompt = `Convert the following content into well-structured study notes:\n\n${content}`;
        break;
      case 'video':
        const videoId = extractYouTubeId(content || '')
        
        if (!videoId) {
          console.error('Invalid YouTube URL format:', content);
          res.status(400).json({
            success: false,
            message: 'Invalid YouTube URL. Please provide a valid YouTube link (watch, youtu.be, embed, or shorts).'
          });
          return;
        }

        console.log('Processing video ID:', videoId);

        try {
          // Supadata first, then other fallbacks
          transcript = await fetchTranscriptWithFallback(videoId, content)
          
          if (!transcript) {
            throw new Error('No transcript available')
          }

          console.log('Successfully fetched transcript');
        } catch (error) {
          console.error('Error fetching transcript:', error)
          res.status(400).json({
            success: false,
            message: 'Failed to fetch video transcript. Ensure captions are available (or try another video).'
          })
          return
        }

        prompt = `Create comprehensive study notes from this YouTube video transcript:

${transcript}

Please structure your response as detailed study notes with the following requirements:
1. Start with a clear title using <h1> tags
2. Use <h2> tags for main sections
3. Use <p> tags for paragraphs
4. Use <ul> and <li> tags for bullet points
5. Use <strong> tags for important terms
6. Include key concepts, definitions, and examples
7. Organize the content in a logical, hierarchical structure
8. Include relevant timestamps from the transcript in [brackets]
9. Add a summary section at the beginning
10. Highlight key takeaways at the end

Format the entire response in clean HTML without any markdown or other formatting.`;
        break;
      default:
        prompt = `Create organized study notes from the following:\n\n${content}`;
    }

    console.log('Sending prompt to GPT-5');

    const notesGenerationPrompt = `You are an expert note-taker and educator. Create well-structured study notes using HTML formatting.
          
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
9. For video content, include timestamps in [brackets] to reference specific parts
10. Create a clear hierarchy of information with main concepts and supporting details

${prompt}`;

    const response = await createGPT5Response(notesGenerationPrompt, 'high', 'high');

    let generatedNotes = response.choices[0].message.content || '';

    console.log('Raw response from OpenAI:', generatedNotes);

    // Clean up the response
    generatedNotes = generatedNotes
      .trim()
      .replace(/^```html\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/^\s*<\?xml[^>]*\?>\s*/i, '')
      .replace(/^\s*<!DOCTYPE[^>]*>\s*/i, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '')
      .replace(/>\s+</g, '><')
      .trim();

    if (!generatedNotes.startsWith('<h1>') && !generatedNotes.startsWith('<h1 ')) {
      generatedNotes = `<h1>Study Notes</h1>${generatedNotes}`;
    }

    if (!/^<[^>]+>/.test(generatedNotes)) {
      generatedNotes = `<div>${generatedNotes}</div>`;
    }

    const responseObj = { success: true, notes: generatedNotes };
    const jsonString = JSON.stringify(responseObj);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(jsonString);

    // Increment monthly usage counter for notes
    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'subscription.usage.monthKey': currentPeriodKey() },
      $inc: { 'subscription.usage.notesGenerated': 1 },
    })

  } catch (error) {
    console.error('Error generating notes:', error);
    try { 
      await refundFeatureCredits(req.user._id, 'aiNotes', CREDIT_COSTS.notesAnalysis);
      console.log('AI notes credits refunded due to generation failure');
    } catch (refundError) {
      console.error('Failed to refund AI notes credits:', refundError);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to generate notes. Please try again.'
    });
  }
};

export const saveNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, title } = req.body;
    const userId = req.user._id;

    if (!content || !title) {
      res.status(400).json({
        success: false,
        message: 'Both content and title are required'
      });
      return;
    }

    // Always create a new note (don't update existing ones with same title)
    const note = new Note({
      title,
      content,
      userId
    });
    
    await note.save();

    res.status(200).json({
      success: true,
      message: 'Notes saved successfully',
      note // Return the note object directly
    });
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save notes. Please try again.'
    });
  }
};

export const getNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user._id;
    const notes = await Note.find({ userId }).sort({ updatedAt: -1 });
    res.status(200).json({
      success: true,
      notes
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notes'
    });
  }
};

export const createNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content } = req.body;
    const userId = req.user._id;

    const note = await Note.create({
      title,
      content,
      userId
    });

    res.status(201).json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create note'
    });
  }
};

export const getNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const note = await Note.findOne({ _id: id, userId });

    if (!note) {
      res.status(404).json({
        success: false,
        message: 'Note not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch note'
    });
  }
};

export const updateNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = req.user._id;

    console.log('Updating note:', { id, userId, title });

    const note = await Note.findOneAndUpdate(
      { _id: id, userId },
      { title, content },
      { new: true }
    );

    if (!note) {
      res.status(404).json({
        success: false,
        message: 'Note not found'
      });
      return;
    }

    console.log('Note updated successfully:', note.title);

    res.status(200).json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update note. Please try again.'
    });
  }
};

export const deleteNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const note = await Note.findOneAndDelete({ _id: id, userId });

    if (!note) {
      res.status(404).json({
        success: false,
        message: 'Note not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete note'
    });
  }
}; 