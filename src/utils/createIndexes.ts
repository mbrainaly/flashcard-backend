import mongoose from 'mongoose';
import User from '../models/User';
import Deck from '../models/Deck';
import Card from '../models/Card';
import Quiz from '../models/Quiz';
import Note from '../models/note.model';
import Subscription from '../models/Subscription';

export async function createPerformanceIndexes() {
  try {
    console.log('Creating performance indexes...');

    // User collection indexes
    await User.collection.createIndex({ name: 1 });
    await User.collection.createIndex({ email: 1 });
    await User.collection.createIndex({ createdAt: -1 });
    await User.collection.createIndex({ lastLogin: -1 });
    await User.collection.createIndex({ isActive: 1 });
    await User.collection.createIndex({ provider: 1 });
    await User.collection.createIndex({ 'subscription.plan': 1 });
    await User.collection.createIndex({ 'subscription.status': 1 });
    
    // Compound indexes for common queries
    await User.collection.createIndex({ name: 'text', email: 'text' });
    await User.collection.createIndex({ isActive: 1, createdAt: -1 });
    await User.collection.createIndex({ 'subscription.plan': 1, createdAt: -1 });

    // Deck collection indexes
    await Deck.collection.createIndex({ owner: 1 });
    await Deck.collection.createIndex({ owner: 1, createdAt: -1 });
    await Deck.collection.createIndex({ createdAt: -1 });

    // Card collection indexes
    await Card.collection.createIndex({ createdBy: 1 });
    await Card.collection.createIndex({ deckId: 1 });

    // Quiz collection indexes
    await Quiz.collection.createIndex({ owner: 1 });
    await Quiz.collection.createIndex({ owner: 1, createdAt: -1 });

    // Note collection indexes
    await Note.collection.createIndex({ userId: 1 });

    // Subscription collection indexes
    await Subscription.collection.createIndex({ userId: 1 });
    await Subscription.collection.createIndex({ userId: 1, status: 1 });
    await Subscription.collection.createIndex({ status: 1 });

    console.log('Performance indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
}
