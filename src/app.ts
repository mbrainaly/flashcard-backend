import express, { Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.routes';
import deckRoutes from './routes/deck.routes';
import cardRoutes from './routes/card.routes';
import aiRoutes from './routes/ai.routes';
import notesRoutes from './routes/notes.routes';
import subscriptionRoutes from './routes/subscription.routes';
import quizRoutes from './routes/quiz.routes';

const app = express();

// Handle uploads directory based on environment
let uploadsDir = path.join(__dirname, '../uploads');

// In production (Vercel), we'll use S3 or another cloud storage
// This conditional check prevents file system operations in serverless environments
if (process.env.NODE_ENV !== 'production') {
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    console.log('Uploads directory configured:', uploadsDir);
    
    // Serve static files from the uploads directory in development only
    app.use('/uploads', express.static(uploadsDir));
    console.log('Serving uploads from:', uploadsDir);
  } catch (error) {
    console.error('Error creating uploads directory:', error);
  }
} else {
  console.log('Running in production mode. File uploads will use cloud storage.');
}

// CORS configuration with increased preflight timeout
const corsOptions = {
  origin: ['https://aiflashcard.net', 'https://www.aiflashcard.net', process.env.FRONTEND_URL || 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Date', 'X-Api-Version'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));

// Configure body parser with larger limits
app.use(express.raw({ 
  type: 'application/octet-stream',
  limit: '10mb' 
}));

app.use(express.json({
  limit: '50mb',
  verify: (req: express.Request, res: Response, buf, encoding) => {
    if (buf && buf.length > 20 * 1024 * 1024) { // 20MB in bytes
      throw new Error('Request entity too large');
    }
  }
}));

app.use(express.urlencoded({
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
app.use('/api/auth', authRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api', cardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/quizzes', quizRoutes);

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
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

export default app; 