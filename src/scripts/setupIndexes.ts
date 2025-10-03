#!/usr/bin/env node

import mongoose from 'mongoose';
import { createPerformanceIndexes } from '../utils/createIndexes';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupIndexes() {
  try {
    console.log('🚀 Setting up database indexes for performance optimization...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Create indexes
    await createPerformanceIndexes();
    
    console.log('🎉 All indexes created successfully!');
    console.log('📈 Your application should now have significantly better performance for:');
    console.log('   - User search queries');
    console.log('   - Pagination');
    console.log('   - Filtering operations');
    console.log('   - Sorting operations');
    
  } catch (error) {
    console.error('❌ Error setting up indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the setup
setupIndexes();
