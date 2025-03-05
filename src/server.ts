import dotenv from 'dotenv';
import connectDB from './config/database';
import app from './app';

// Load environment variables
dotenv.config();

// Initialize server
const init = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
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