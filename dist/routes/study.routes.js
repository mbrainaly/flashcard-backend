"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const study_controller_1 = require("../controllers/study.controller");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Protected routes
router.use(auth_1.protect);
router.post('/evaluate', study_controller_1.evaluateAnswer);
router.post('/quiz/generate', study_controller_1.generateQuizQuestion);
exports.default = router;
//# sourceMappingURL=study.routes.js.map