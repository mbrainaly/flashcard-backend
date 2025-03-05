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
exports.changePassword = exports.updateProfile = exports.getMe = exports.login = exports.register = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
// Generate JWT Token
const generateToken = (id) => {
    const token = jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET);
    return token;
};
// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Registration request received:', req.body);
        const { name, email, password } = req.body;
        // Validate input
        if (!name || !email || !password) {
            console.log('Missing required fields:', { name: !!name, email: !!email, password: !!password });
            res.status(400).json({ message: 'Please provide all required fields' });
            return;
        }
        // Check if user exists
        console.log('Checking if user exists:', email);
        const userExists = yield User_1.default.findOne({ email });
        if (userExists) {
            console.log('User already exists:', email);
            res.status(400).json({ message: 'User already exists' });
            return;
        }
        // Create user
        console.log('Creating new user:', { name, email });
        const user = yield User_1.default.create({
            name,
            email,
            password,
        });
        if (user) {
            console.log('User created successfully:', user._id);
            res.status(201).json({
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    subscription: user.subscription
                },
                token: generateToken(user._id),
            });
        }
    }
    catch (error) {
        console.error('Error in user registration:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
        }
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.register = register;
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        // Validate input
        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
            return;
        }
        // Check for user email
        const user = yield User_1.default.findOne({ email });
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
            return;
        }
        // Check password
        const isMatch = yield user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
            return;
        }
        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                subscription: user.subscription
            },
            token: generateToken(user._id),
        });
    }
    catch (error) {
        console.error('Error in user login:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});
exports.login = login;
// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User_1.default.findById(req.user._id).select('-password');
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                subscription: user.subscription
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
exports.getMe = getMe;
// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email } = req.body;
        // Validate input
        if (!name || !email) {
            res.status(400).json({
                success: false,
                message: 'Please provide name and email'
            });
            return;
        }
        // Check if email is already taken (if email is being changed)
        const existingUser = yield User_1.default.findOne({ email });
        if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
            res.status(400).json({
                success: false,
                message: 'Email already in use'
            });
            return;
        }
        // Update user
        const user = yield User_1.default.findByIdAndUpdate(req.user._id, { name, email }, { new: true }).select('-password');
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            }
        });
    }
    catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during profile update'
        });
    }
});
exports.updateProfile = updateProfile;
// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { currentPassword, newPassword } = req.body;
        // Validate input
        if (!currentPassword || !newPassword) {
            res.status(400).json({
                success: false,
                message: 'Please provide current and new password'
            });
            return;
        }
        // Get user
        const user = yield User_1.default.findById(req.user._id);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        // Check current password
        const isMatch = yield user.comparePassword(currentPassword);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
            return;
        }
        // Update password
        user.password = newPassword;
        yield user.save();
        res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });
    }
    catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during password change'
        });
    }
});
exports.changePassword = changePassword;
//# sourceMappingURL=auth.controller.js.map