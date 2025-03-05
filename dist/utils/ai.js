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
exports.generateFlashcards = generateFlashcards;
exports.analyzeContent = analyzeContent;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const bedrock_1 = __importDefault(require("../config/bedrock"));
const FLASHCARD_SYSTEM_PROMPT = `You are an expert educator and flashcard creator. Your task is to create effective flashcards that follow these principles:
1. Clear and concise content
2. One main concept per card
3. Precise language
4. Include relevant examples when helpful
5. Add hints for complex topics
6. Ensure accuracy of information`;
function invokeClaude(systemPrompt, userPrompt) {
    return __awaiter(this, void 0, void 0, function* () {
        const prompt = `\n\nHuman: ${systemPrompt}\n\n${userPrompt}\n\nAssistant: `;
        const command = new client_bedrock_runtime_1.InvokeModelCommand({
            modelId: "anthropic.claude-v2",
            body: JSON.stringify({
                prompt,
                max_tokens_to_sample: 2000,
                temperature: 0.7,
                top_p: 0.9,
            }),
            contentType: "application/json",
            accept: "application/json",
        });
        const response = yield bedrock_1.default.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        return responseBody.completion;
    });
}
function generateFlashcards(_a) {
    return __awaiter(this, arguments, void 0, function* ({ topic, content, numberOfCards = 5, difficulty = 'intermediate', }) {
        try {
            console.log('Starting flashcard generation with Claude...');
            console.log('Parameters:', { topic, numberOfCards, difficulty });
            const userPrompt = `Create ${numberOfCards} flashcards about "${topic}" at ${difficulty} level.
${content ? `Use this content as reference: ${content}` : ''}

Format each flashcard as a JSON object with these fields:
- front: The question or prompt
- back: The answer or explanation
- hints: (optional) Array of helpful hints
- examples: (optional) Array of relevant examples

Return the flashcards as a JSON array.`;
            console.log('Sending request to Claude...');
            const completion = yield invokeClaude(FLASHCARD_SYSTEM_PROMPT, userPrompt);
            console.log('Received response from Claude');
            if (!completion) {
                console.error('No content in Claude response');
                throw new Error('No content generated');
            }
            console.log('Parsing Claude response...');
            try {
                // Extract JSON array from the response
                const jsonMatch = completion.match(/\[[\s\S]*\]/);
                if (!jsonMatch) {
                    throw new Error('No JSON array found in response');
                }
                const parsedContent = JSON.parse(jsonMatch[0]);
                console.log('Successfully parsed response');
                return parsedContent;
            }
            catch (parseError) {
                console.error('Failed to parse Claude response:', completion);
                console.error('Parse error:', parseError);
                throw new Error('Failed to parse generated content');
            }
        }
        catch (error) {
            console.error('Error in generateFlashcards:', error);
            if (error instanceof Error) {
                console.error('Error details:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    });
}
function analyzeContent(content) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const systemPrompt = 'You are an expert content analyzer. Analyze the given content and extract key concepts, suggested flashcard topics, and difficulty level.';
            const userPrompt = `Analyze this content and provide:
1. Key concepts (as an array)
2. Suggested flashcard topics (as an array)
3. Recommended difficulty level
4. Estimated number of flashcards needed

Return the analysis as a JSON object.

Content: ${content}`;
            console.log('Analyzing content:', content);
            const completion = yield invokeClaude(systemPrompt, userPrompt);
            console.log('Received analysis response:', completion);
            if (!completion) {
                throw new Error('No analysis generated');
            }
            // Extract JSON object from the response
            const jsonMatch = completion.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON object found in response');
            }
            return JSON.parse(jsonMatch[0]);
        }
        catch (error) {
            console.error('Error analyzing content:', error);
            throw new Error('Failed to analyze content');
        }
    });
}
//# sourceMappingURL=ai.js.map