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
exports.getHomeworkHelp = void 0;
const openai_1 = __importDefault(require("../config/openai"));
const fileProcessing_1 = require("../utils/fileProcessing");
// @desc    Get homework help
// @route   POST /api/ai/homework-help
// @access  Private
const getHomeworkHelp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { subject, question } = req.body;
        let fileContent = '';
        if (!subject || !question) {
            res.status(400).json({
                success: false,
                message: 'Subject and question are required'
            });
            return;
        }
        // Process uploaded file if present
        if (req.file) {
            try {
                fileContent = yield (0, fileProcessing_1.extractTextFromFile)(req.file);
            }
            catch (error) {
                console.error('Error processing file:', error);
                res.status(400).json({
                    success: false,
                    message: 'Failed to process uploaded file'
                });
                return;
            }
        }
        const response = yield openai_1.default.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert tutor helping students with their homework. You specialize in ${subject}.
          
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

Keep explanations clear and educational, encouraging understanding rather than just providing answers.`
                },
                {
                    role: 'user',
                    content: `Question: ${question}
${fileContent ? `\nAdditional Context:\n${fileContent}` : ''}`
                }
            ],
            temperature: 0.7,
        });
        const answer = response.choices[0].message.content || '';
        res.status(200).json({
            success: true,
            answer
        });
    }
    catch (error) {
        console.error('Error getting homework help:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get homework help'
        });
    }
});
exports.getHomeworkHelp = getHomeworkHelp;
//# sourceMappingURL=homework.controller.js.map