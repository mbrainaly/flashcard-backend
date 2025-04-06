"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const deck_routes_1 = __importDefault(require("./routes/deck.routes"));
const card_routes_1 = __importDefault(require("./routes/card.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const notes_routes_1 = __importDefault(require("./routes/notes.routes"));
const subscription_routes_1 = __importDefault(require("./routes/subscription.routes"));
const quiz_routes_1 = __importDefault(require("./routes/quiz.routes"));
const app = (0, express_1.default)();
// Handle uploads directory based on environment
let uploadsDir = path_1.default.join(__dirname, '../uploads');
// In production (Vercel), we'll use S3 or another cloud storage
// This conditional check prevents file system operations in serverless environments
if (process.env.NODE_ENV !== 'production') {
    try {
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        }
        console.log('Uploads directory configured:', uploadsDir);
        // Serve static files from the uploads directory in development only
        app.use('/uploads', express_1.default.static(uploadsDir));
        console.log('Serving uploads from:', uploadsDir);
    }
    catch (error) {
        console.error('Error creating uploads directory:', error);
    }
}
else {
    console.log('Running in production mode. File uploads will use cloud storage.');
}
// CORS configuration with increased preflight timeout
const corsOptions = {
    origin: '*', // Allow all origins - Vercel config will restrict if needed
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
};
// Apply CORS middleware to all routes
app.use((0, cors_1.default)(corsOptions));
// Handle preflight requests for all routes
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.status(204).send();
});
// Configure body parser with larger limits
app.use(express_1.default.raw({
    type: 'application/octet-stream',
    limit: '10mb'
}));
app.use(express_1.default.json({
    limit: '50mb',
    verify: (req, res, buf, encoding) => {
        if (buf && buf.length > 20 * 1024 * 1024) { // 20MB in bytes
            throw new Error('Request entity too large');
        }
    }
}));
app.use(express_1.default.urlencoded({
    limit: '50mb',
    extended: true,
    parameterLimit: 50000
}));
// Request size logging middleware
app.use((req, res, next) => {
    const contentLength = req.headers['content-length'];
    if (contentLength) {
        console.log(`Incoming request size: ${contentLength} bytes`);
    }
    next();
});
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/decks', deck_routes_1.default);
app.use('/api', card_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
app.use('/api/notes', notes_routes_1.default);
app.use('/api/subscription', subscription_routes_1.default);
app.use('/api/quizzes', quiz_routes_1.default);
// Health check endpoint for Vercel
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Server is running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON payload'
        });
    }
    if (err.type === 'entity.too.large' || err.message === 'Request entity too large') {
        return res.status(413).json({
            success: false,
            message: 'File too large. Maximum size is 10MB.'
        });
    }
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map