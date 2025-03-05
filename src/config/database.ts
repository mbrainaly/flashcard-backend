import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Cache the database connection
let cachedConnection: typeof mongoose | null = null;

const connectDB = async (): Promise<void> => {
  try {
    // If we already have a connection, use it
    if (cachedConnection) {
      console.log('Using cached database connection');
      return;
    }

    console.log('Attempting to connect to MongoDB...');
    console.log('MongoDB URI:', process.env.MONGODB_URI?.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // Log URI with hidden password
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Set mongoose options optimized for serverless
    const options: mongoose.ConnectOptions = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    
    // Cache the connection
    cachedConnection = mongoose;
    
    // Log connection status
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log('Database name:', conn.connection.name);
    console.log('Connection state:', conn.connection.readyState);

    // Ensure indexes are created
    try {
      await mongoose.connection.db.collection('users').dropIndex('email_1');
      console.log('Dropped existing email index');
    } catch (error) {
      console.log('No username index to drop or already dropped');
    }

    await mongoose.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
    console.log('User indexes verified');

  } catch (error) {
    console.error('Error connecting to MongoDB:');
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // In serverless environments, we don't want to exit the process
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    } else {
      throw error; // Re-throw for proper error handling in serverless
    }
  }
};

export default connectDB; 