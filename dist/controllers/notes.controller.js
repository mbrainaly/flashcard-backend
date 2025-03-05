"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNote = exports.updateNote = exports.getNote = exports.createNote = exports.getNotes = exports.saveNotes = exports.generateNotes = void 0;
const youtube_transcript_1 = require("youtube-transcript");
const openai_1 = __importDefault(require("../config/openai"));
const models_1 = require("../models");
const generateNotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { content, type } = req.body;
        console.log('Received request:', { type, content });
        if (!content) {
            res.status(400).json({
                success: false,
                message: 'Content is required'
            });
            return;
        }
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
                // Extract video ID for cleaner prompt
                const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/i;
                const match = content.match(youtubeRegex);
                if (!match || !match[1]) {
                    console.error('Invalid YouTube URL format:', content);
                    res.status(400).json({
                        success: false,
                        message: 'Invalid YouTube URL format. Please provide a valid YouTube URL (e.g., https://youtube.com/watch?v=... or https://youtu.be/...).'
                    });
                    return;
                }
                const videoId = match[1];
                console.log('Processing video ID:', videoId);
                try {
                    // Fetch video transcript
                    const transcriptResponse = yield youtube_transcript_1.YoutubeTranscript.fetchTranscript(videoId);
                    transcript = transcriptResponse
                        .map(item => `[${Math.floor(item.offset / 1000 / 60)}:${Math.floor((item.offset / 1000) % 60).toString().padStart(2, '0')}] ${item.text}`)
                        .join('\n');
                    if (!transcript) {
                        throw new Error('No transcript available');
                    }
                    console.log('Successfully fetched transcript');
                }
                catch (error) {
                    console.error('Error fetching transcript:', error);
                    res.status(400).json({
                        success: false,
                        message: 'Failed to fetch video transcript. Please ensure the video has subtitles enabled.'
                    });
                    return;
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
        console.log('Sending prompt to OpenAI');
        const response = yield openai_1.default.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert note-taker and educator. Create well-structured study notes using HTML formatting.
          
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
10. Create a clear hierarchy of information with main concepts and supporting details`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 4000,
        });
        let generatedNotes = response.choices[0].message.content || '';
        console.log('Raw response from OpenAI:', generatedNotes);
        // Clean up the response
        generatedNotes = generatedNotes
            .trim()
            // Remove any markdown code block markers
            .replace(/^```html\s*/i, '')
            .replace(/\s*```$/i, '')
            // Remove any XML or DOCTYPE declarations
            .replace(/^\s*<\?xml[^>]*\?>\s*/i, '')
            .replace(/^\s*<!DOCTYPE[^>]*>\s*/i, '')
            // Remove any comments
            .replace(/<!--[\s\S]*?-->/g, '')
            // Remove any html/body tags
            .replace(/<\/?html[^>]*>/gi, '')
            .replace(/<\/?body[^>]*>/gi, '')
            // Remove any extra whitespace between tags
            .replace(/>\s+</g, '><')
            // Ensure proper spacing
            .trim();
        console.log('Cleaned notes:', generatedNotes);
        // Validate the HTML structure
        if (!generatedNotes.startsWith('<h1>') && !generatedNotes.startsWith('<h1 ')) {
            console.log('Adding h1 wrapper');
            generatedNotes = `<h1>Study Notes</h1>${generatedNotes}`;
        }
        // Ensure all content is wrapped in HTML tags
        if (!/^<[^>]+>/.test(generatedNotes)) {
            console.log('Adding div wrapper');
            generatedNotes = `<div>${generatedNotes}</div>`;
        }
        // Create response object
        const responseObj = {
            success: true,
            notes: generatedNotes
        };
        // Convert to JSON string
        const jsonString = JSON.stringify(responseObj);
        console.log('Final response length:', jsonString.length);
        // Set headers and send response
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(jsonString);
    }
    catch (error) {
        console.error('Error generating notes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate notes. Please try again.'
        });
    }
});
exports.generateNotes = generateNotes;
const saveNotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        // Create or update note
        const note = yield models_1.Note.findOneAndUpdate({ userId, title }, // find by userId and title
        { content, userId }, // update content
        { upsert: true, new: true } // create if doesn't exist, return updated doc
        );
        res.status(200).json({
            success: true,
            message: 'Notes saved successfully',
            note // Return the note object directly
        });
    }
    catch (error) {
        console.error('Error saving notes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save notes. Please try again.'
        });
    }
});
exports.saveNotes = saveNotes;
const getNotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user._id;
        const notes = yield models_1.Note.find({ userId }).sort({ updatedAt: -1 });
        res.status(200).json({
            success: true,
            notes
        });
    }
    catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notes'
        });
    }
});
exports.getNotes = getNotes;
const createNote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, content } = req.body;
        const userId = req.user._id;
        const note = yield models_1.Note.create({
            title,
            content,
            userId
        });
        res.status(201).json({
            success: true,
            note
        });
    }
    catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create note'
        });
    }
});
exports.createNote = createNote;
const getNote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const note = yield models_1.Note.findOne({ _id: id, userId });
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
    }
    catch (error) {
        console.error('Error fetching note:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch note'
        });
    }
});
exports.getNote = getNote;
const updateNote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { title, content } = req.body;
        const userId = req.user._id;
        console.log('Updating note:', { id, userId, title });
        const note = yield models_1.Note.findOneAndUpdate({ _id: id, userId }, { title, content }, { new: true });
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
    }
    catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update note. Please try again.'
        });
    }
});
exports.updateNote = updateNote;
const deleteNote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const note = yield models_1.Note.findOneAndDelete({ _id: id, userId });
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
    }
    catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete note'
        });
    }
});
exports.deleteNote = deleteNote;
//# sourceMappingURL=notes.controller.js.map