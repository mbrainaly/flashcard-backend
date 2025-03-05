import { Request, Response } from 'express';
import Deck from '../models/Deck';
import Card from '../models/Card';
import { calculateProgress } from '../utils/spacedRepetition';

// @desc    Create a new deck
// @route   POST /api/decks
// @access  Private
export const createDeck = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, tags, isPublic } = req.body;

    const deck = await Deck.create({
      title,
      description,
      tags,
      isPublic,
      owner: req.user._id,
    });

    res.status(201).json(deck);
  } catch (error) {
    res.status(500).json({ message: 'Error creating deck' });
  }
};

// @desc    Get all decks for current user
// @route   GET /api/decks
// @access  Private
export const getDecks = async (req: Request, res: Response): Promise<void> => {
  try {
    const decks = await Deck.find({ owner: req.user._id })
      .sort({ updatedAt: -1 });

    res.status(200).json(decks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching decks' });
  }
};

// @desc    Get a single deck
// @route   GET /api/decks/:id
// @access  Private
export const getDeck = async (req: Request, res: Response): Promise<void> => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck) {
      res.status(404).json({ message: 'Deck not found' });
      return;
    }

    // Check ownership or public access
    if (deck.owner.toString() !== req.user._id.toString() && !deck.isPublic) {
      res.status(403).json({ message: 'Not authorized to access this deck' });
      return;
    }

    // Get cards count by status
    const cardStats = await Card.aggregate([
      { $match: { deck: deck._id } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);

    // Calculate progress
    const stats = cardStats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, { mastered: 0, learning: 0, new: 0 });

    deck.studyProgress = stats;
    
    res.status(200).json(deck);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching deck' });
  }
};

// @desc    Update a deck
// @route   PUT /api/decks/:id
// @access  Private
export const updateDeck = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, tags, isPublic } = req.body;

    const deck = await Deck.findById(req.params.id);

    if (!deck) {
      res.status(404).json({ message: 'Deck not found' });
      return;
    }

    // Check ownership
    if (deck.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to update this deck' });
      return;
    }

    deck.title = title || deck.title;
    deck.description = description || deck.description;
    deck.tags = tags || deck.tags;
    deck.isPublic = isPublic !== undefined ? isPublic : deck.isPublic;

    const updatedDeck = await deck.save();

    res.status(200).json(updatedDeck);
  } catch (error) {
    res.status(500).json({ message: 'Error updating deck' });
  }
};

// @desc    Delete a deck
// @route   DELETE /api/decks/:id
// @access  Private
export const deleteDeck = async (req: Request, res: Response): Promise<void> => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck) {
      res.status(404).json({ message: 'Deck not found' });
      return;
    }

    // Check ownership
    if (deck.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to delete this deck' });
      return;
    }

    // Delete all cards in the deck
    await Card.deleteMany({ deck: deck._id });

    // Delete the deck
    await deck.deleteOne();

    res.status(200).json({ message: 'Deck deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting deck' });
  }
};

// @desc    Get public decks
// @route   GET /api/decks/public
// @access  Public
export const getPublicDecks = async (req: Request, res: Response): Promise<void> => {
  try {
    const decks = await Deck.find({ isPublic: true })
      .sort({ updatedAt: -1 })
      .limit(20);

    res.status(200).json(decks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching public decks' });
  }
};

// @desc    Search decks
// @route   GET /api/decks/search
// @access  Private
export const searchDecks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, tags } = req.query;
    
    const searchQuery: any = {
      $or: [
        { owner: req.user._id },
        { isPublic: true }
      ]
    };

    if (query) {
      searchQuery.$or.push(
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      );
    }

    if (tags) {
      searchQuery.tags = { $in: (tags as string).split(',') };
    }

    const decks = await Deck.find(searchQuery)
      .sort({ updatedAt: -1 })
      .limit(20);

    res.status(200).json(decks);
  } catch (error) {
    res.status(500).json({ message: 'Error searching decks' });
  }
}; 