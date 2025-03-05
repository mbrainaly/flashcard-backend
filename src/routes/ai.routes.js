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
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const s3_1 = __importDefault(require("../config/s3"));
const client_s3_1 = require("@aws-sdk/client-s3");
const auth_1 = require("../middleware/auth");
const ai_controller_1 = require("../controllers/ai.controller");
const practice_controller_1 = require("../controllers/practice.controller");
const homework_controller_1 = require("../controllers/homework.controller");
const document_controller_1 = require("../controllers/document.controller");
const router = express_1.default.Router();
// Configure multer for document uploads
const storage = multer_1.default.memoryStorage(); // Store files in memory
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB limit for documents
    },
    fileFilter: function (req, file, cb) {
        const filetypes = /pdf|docx|doc|txt|rtf|jpg|jpeg|png/;
        const extname = filetypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = file.mimetype.includes('pdf') ||
            file.mimetype.includes('document') ||
            file.mimetype.includes('text') ||
            file.mimetype.includes('image');
        if (mimetype && extname) {
            console.log(`Processing document: ${file.originalname}, size: ${file.size} bytes`);
            return cb(null, true);
        }
        cb(new Error('Only document and image files (PDF, DOCX, TXT, JPG, PNG) are allowed!'));
    }
});
// Protected routes
router.use(auth_1.protect);
// Route for uploading documents to S3
router.post('/upload-document', upload.single('document'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }
        const uploadParams = {
            Bucket: 'wetransferv1',
            Key: `${Date.now()}-${file.originalname}`,
            Body: file.buffer,
            ContentType: file.mimetype,
        };
        const command = new client_s3_1.PutObjectCommand(uploadParams);
        yield s3_1.default.send(command);
        res.status(200).json({ message: 'File uploaded successfully!' });
    }
    catch (error) {
        if (error.name === 'PayloadTooLargeError') {
            return res.status(413).json({ message: 'File size exceeds the limit.' });
        }
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Failed to upload document. Please try again.' });
    }
}));
// Other routes
router.post('/analyze-content', ai_controller_1.analyzeContentForFlashcards);
router.post('/analyze-quiz-content', ai_controller_1.analyzeQuizContent);
router.post('/generate-flashcards', ai_controller_1.generateFlashcardsForDeck);
router.post('/evaluate-answer', ai_controller_1.evaluateAnswer);
router.post('/generate-quiz', ai_controller_1.generateQuizQuestion);
router.post('/explain', ai_controller_1.explainFlashcard);
router.post('/generate-quiz-complete', ai_controller_1.generateQuiz);
router.post('/flashcards/generate', ai_controller_1.generateFlashcardsForDeck);
router.post('/quiz/generate', ai_controller_1.generateQuizQuestion);
router.post('/explain-concept', ai_controller_1.explainConcept);
router.post('/answer-question', ai_controller_1.answerQuestion);
// Practice problem routes
router.post('/generate-problems', practice_controller_1.generateProblems);
router.post('/check-answer', practice_controller_1.checkAnswer);
// Homework help route
router.post('/homework-help', upload.single('file'), homework_controller_1.getHomeworkHelp);
// Document analysis route
router.post('/analyze-document', upload.single('file'), auth_1.protect, document_controller_1.analyzeDocument);
exports.default = router;
