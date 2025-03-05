"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const quiz_controller_1 = require("../controllers/quiz.controller");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Public routes
router.get('/public', quiz_controller_1.getPublicQuizzes);
// Protected routes
router.use(auth_1.protect);
// Notes quiz routes (place these before generic routes to avoid conflicts)
router.post('/notes/:id/generate', quiz_controller_1.generateQuiz);
router.get('/notes/:id', quiz_controller_1.getQuiz);
router.post('/notes/:id/submit', quiz_controller_1.submitQuizAttempt);
// General quiz routes
router.route('/')
    .get(quiz_controller_1.getQuizzes)
    .post(quiz_controller_1.createQuiz);
router.get('/search', quiz_controller_1.searchQuizzes);
router.route('/:id')
    .get(quiz_controller_1.getQuiz)
    .put(quiz_controller_1.updateQuiz)
    .delete(quiz_controller_1.deleteQuiz);
// Quiz submission route
router.post('/:id/submit', quiz_controller_1.submitQuizAttempt);
exports.default = router;
//# sourceMappingURL=quiz.routes.js.map