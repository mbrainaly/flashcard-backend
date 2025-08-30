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
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

// Start the server
init(); 