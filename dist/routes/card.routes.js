"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const card_controller_1 = require("../controllers/card.controller");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        // Save to frontend public folder - go up one level from backend to reach frontend
        const uploadPath = path_1.default.join(process.cwd(), '..', 'frontend', 'public', 'uploads', 'cards');
        console.log('Upload path:', uploadPath); // Debug log
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + path_1.default.extname(file.originalname);
        console.log('Generated filename:', filename); // Debug log
        cb(null, filename);
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|pdf|docx|txt/; // Allow documents
        const extname = filetypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            console.log(`Uploading file: ${file.originalname}, size: ${file.size} bytes`); // Log file size
            return cb(null, true);
        }
        cb(new Error('Only image and document files are allowed!'));
    }
});
// All routes are protected
router.use(auth_1.protect);
// Routes for cards within a deck
router.route('/decks/:deckId/cards')
    .get(card_controller_1.getCards)
    .post(upload.single('image'), card_controller_1.createCard);
router.get('/decks/:deckId/cards/due', card_controller_1.getDueCards);
// Routes for individual cards
router.route('/cards/:id')
    .put(upload.single('image'), card_controller_1.updateCard)
    .delete(card_controller_1.deleteCard);
router.post('/cards/:id/review', card_controller_1.reviewCard);
exports.default = router;
//# sourceMappingURL=card.routes.js.map