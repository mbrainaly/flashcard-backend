"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.getSubscription = exports.updateSubscription = exports.createCheckoutSession = void 0;
const stripe_1 = __importStar(require("../config/stripe"));
const User_1 = __importDefault(require("../models/User"));
// @desc    Create a checkout session for subscription
// @route   POST /api/subscription/create-checkout-session
// @access  Private
const createCheckoutSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { planId } = req.body;
        const userId = req.user._id;
        console.log('Creating checkout session for user:', userId, 'plan:', planId);
        // Get the plan details
        let plan;
        switch (planId) {
            case 'pro':
                plan = stripe_1.SUBSCRIPTION_PLANS.PRO;
                break;
            case 'team':
                plan = stripe_1.SUBSCRIPTION_PLANS.TEAM;
                break;
            default:
                console.log('Invalid plan selected:', planId);
                res.status(400).json({ success: false, message: 'Invalid plan selected' });
                return;
        }
        // Get the user
        const user = yield User_1.default.findById(userId);
        if (!user) {
            console.log('User not found:', userId);
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        // Ensure we have a valid frontend URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        console.log('Using frontend URL:', frontendUrl);
        console.log('Creating Stripe checkout session with plan:', plan.name);
        // For test environment, we'll create a simple checkout session
        // In production, you would use actual Stripe products and prices
        try {
            const session = yield stripe_1.default.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: `${plan.name} Plan`,
                                description: `${plan.name} subscription plan with ${plan.credits} credits`,
                            },
                            unit_amount: plan.price * 100, // Convert to cents
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${frontendUrl}/billing?success=true&plan=${planId}`,
                cancel_url: `${frontendUrl}/billing?canceled=true`,
                metadata: {
                    userId: userId.toString(),
                    planId: planId,
                },
            });
            console.log('Checkout session created:', session.id);
            res.status(200).json({ success: true, sessionId: session.id, url: session.url });
        }
        catch (stripeError) {
            console.error('Stripe error creating checkout session:', stripeError);
            res.status(500).json({
                success: false,
                message: 'Failed to create Stripe checkout session',
                error: stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error'
            });
        }
    }
    catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create checkout session',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.createCheckoutSession = createCheckoutSession;
// @desc    Update user subscription after successful payment
// @route   POST /api/subscription/update-subscription
// @access  Private
const updateSubscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { planId } = req.body;
        const userId = req.user._id;
        // Get the plan details
        let plan;
        switch (planId) {
            case 'basic':
                plan = stripe_1.SUBSCRIPTION_PLANS.BASIC;
                break;
            case 'pro':
                plan = stripe_1.SUBSCRIPTION_PLANS.PRO;
                break;
            case 'team':
                plan = stripe_1.SUBSCRIPTION_PLANS.TEAM;
                break;
            default:
                res.status(400).json({ success: false, message: 'Invalid plan selected' });
                return;
        }
        // Update user subscription
        const user = yield User_1.default.findByIdAndUpdate(userId, {
            'subscription.plan': planId,
            'subscription.status': 'active',
            'subscription.currentPeriodEnd': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            'subscription.credits': plan.credits,
        }, { new: true });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        res.status(200).json({
            success: true,
            subscription: user.subscription,
            message: `Successfully upgraded to ${plan.name} plan`,
        });
    }
    catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ success: false, message: 'Failed to update subscription' });
    }
});
exports.updateSubscription = updateSubscription;
// @desc    Get user subscription details
// @route   GET /api/subscription
// @access  Private
const getSubscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user._id;
        const user = yield User_1.default.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        // Get the plan details
        let planDetails;
        switch (user.subscription.plan) {
            case 'basic':
                planDetails = stripe_1.SUBSCRIPTION_PLANS.BASIC;
                break;
            case 'pro':
                planDetails = stripe_1.SUBSCRIPTION_PLANS.PRO;
                break;
            case 'team':
                planDetails = stripe_1.SUBSCRIPTION_PLANS.TEAM;
                break;
            default:
                planDetails = stripe_1.SUBSCRIPTION_PLANS.BASIC;
        }
        res.status(200).json({
            success: true,
            subscription: Object.assign(Object.assign({}, user.subscription), { planDetails }),
        });
    }
    catch (error) {
        console.error('Error getting subscription:', error);
        res.status(500).json({ success: false, message: 'Failed to get subscription details' });
    }
});
exports.getSubscription = getSubscription;
