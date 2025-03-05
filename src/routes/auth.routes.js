"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Public routes
router.post('/register', auth_controller_1.register);
router.post('/login', auth_controller_1.login);
// Protected routes
router.use(auth_1.protect);
router.get('/me', auth_controller_1.getMe);
router.put('/update-profile', auth_controller_1.updateProfile);
router.put('/change-password', auth_controller_1.changePassword);
exports.default = router;
