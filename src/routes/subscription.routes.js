"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const subscription_controller_1 = require("../controllers/subscription.controller");
const router = express_1.default.Router();
// All routes are protected and require authentication
router.use(auth_1.protect);
// Get subscription details
router.get('/', subscription_controller_1.getSubscription);
// Create checkout session
router.post('/create-checkout-session', subscription_controller_1.createCheckoutSession);
// Update subscription after successful payment
router.post('/update-subscription', subscription_controller_1.updateSubscription);
exports.default = router;
