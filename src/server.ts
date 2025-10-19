import dotenv from 'dotenv';
import connectDB from './config/database';
import app from './app';
import { seedDefaultPlans } from './utils/seedPlans';

// Load environment variables
dotenv.config();

// Initialize server
const init = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    // Seed default plans if missing
    await seedDefaultPlans().catch((e) => console.log('Plan seeding skipped:', e?.message || e));
    
    // Start server
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    
    // Set server timeout to 10 minutes for long-running operations
    server.timeout = 600000; // 10 minutes
    server.keepAliveTimeout = 65000; // 65 seconds (should be higher than load balancer timeout)
    server.headersTimeout = 66000; // 66 seconds (should be higher than keepAliveTimeout)
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

// Start the server
init(); 