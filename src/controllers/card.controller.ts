import { Request, Response } from 'express';
import Card from '../models/Card';
import Deck from '../models/Deck';
import { calculateNextReview, initializeCard, isDue } from '../utils/spacedRepetition';
import { checkCardLimit } from '../utils/planLimits';

// @desc    Create a new card
// @route   POST /api/decks/:deckId/cards
// @access  Private
export const createCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deckId } = req.params;
    const { front, back, hints, examples, tags } = req.body;

    // Check if deck exists and user has access
    const deck = await Deck.findById(deckId);
    if (!deck) {
      res.status(404).json({ message: 'Deck not found' });
      return;
    }

    if (deck.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to add cards to this deck' });
      return;
    }

    // Check user's card limit for this deck
    const cardLimitCheck = await checkCardLimit(req.user._id, deckId);
    if (!cardLimitCheck.allowed) {
      res.status(403).json({ 
        message: cardLimitCheck.message,
        currentCount: cardLimitCheck.currentCount,
        maxAllowed: cardLimitCheck.maxAllowed === Infinity ? 'unlimited' : cardLimitCheck.maxAllowed
      });
      return;
    }

    // Handle image upload (URL injected by S3 middleware)
    const image = (req as any).uploadedImageUrl || undefined;

    const card = await Card.create({
      deck: deckId,
      front,
      back,
      hints: hints || [],
      examples: examples || [],
      tags: tags || [],
      image,
      status: 'new',
      createdBy: req.user._id,
      ...initializeCard(),
    });

    // Update deck card count
    deck.totalCards += 1;
    deck.studyProgress.new += 1;
    await deck.save();

    res.status(201).json({
      success: true,
      data: card,
    });
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating card',
    });
  }
};

// @desc    Get all cards in a deck
// @route   GET /api/decks/:deckId/cards
// @access  Private
export const getCards = async (req: Request, res: Response): Promise<void> => {
  try {
    const deck = await Deck.findById(req.params.deckId);
    if (!deck) {
      res.status(404).json({ message: 'Deck not found' });
      return;
    }

    if (deck.owner.toString() !== req.user._id.toString() && !deck.isPublic) {
      res.status(403).json({ message: 'Not authorized to view these cards' });
      return;
    }

    const cards = await Card.find({ deck: req.params.deckId })
      .sort({ createdAt: -1 });

    res.status(200).json(cards);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cards' });
  }
};

// @desc    Get cards due for review
// @route   GET /api/decks/:deckId/cards/due
// @access  Private
export const getDueCards = async (req: Request, res: Response): Promise<void> => {
  try {
    const deck = await Deck.findById(req.params.deckId);
    if (!deck) {
      res.status(404).json({ message: 'Deck not found' });
      return;
    }

    if (deck.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to review these cards' });
      return;
    }

    const now = new Date();
    const cards = await Card.find({
      deck: req.params.deckId,
      nextReview: { $lte: now },
    }).sort({ nextReview: 1 });

    res.status(200).json(cards);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching due cards' });
  }
};

// @desc    Update a card
// @route   PUT /api/cards/:id
// @access  Private
export const updateCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { front, back, hints, examples, tags } = req.body;

    const card = await Card.findById(id);

    if (!card) {
      res.status(404).json({
        success: false,
        message: 'Card not found',
      });
      return;
    }

    // Check if user owns the deck
    const deck = await Deck.findById(card.deck);
    if (!deck || deck.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to update this card' });
      return;
    }

    // Handle image upload (URL injected by S3 middleware)
    const image = (req as any).uploadedImageUrl || card.image;

    card.front = front || card.front;
    card.back = back || card.back;
    card.hints = hints || card.hints;
    card.examples = examples || card.examples;
    card.tags = tags || card.tags;
    card.image = image;

    await card.save();

    res.status(200).json({
      success: true,
      data: card,
    });
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating card',
    });
  }
};

// @desc    Delete a card
// @route   DELETE /api/cards/:id
// @access  Private
export const deleteCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      res.status(404).json({ message: 'Card not found' });
      return;
    }

    // Check if user owns the deck
    const deck = await Deck.findById(card.deck);
    if (!deck || deck.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to delete this card' });
      return;
    }

    // Update deck card count and progress
    deck.totalCards -= 1;
    deck.studyProgress[card.status] -= 1;
    await deck.save();

    await card.deleteOne();

    res.status(200).json({ message: 'Card deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting card' });
  }
};

// @desc    Review a card
// @route   POST /api/cards/:id/review
// @access  Private
export const reviewCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { quality } = req.body;
    
    const card = await Card.findById(req.params.id);
    if (!card) {
      res.status(404).json({ message: 'Card not found' });
      return;
    }

    // Check if user owns the deck
    const deck = await Deck.findById(card.deck);
    if (!deck || deck.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to review this card' });
      return;
    }

    // Calculate next review
    const previousStatus = card.status;
    const result = calculateNextReview(
      quality,
      card.interval,
      card.easeFactor,
      card.repetitions
    );

    // Update card with new values
    card.interval = result.interval;
    card.easeFactor = result.easeFactor;
    card.nextReview = result.nextReview;
    card.lastReviewed = new Date();
    card.status = result.status;
    card.repetitions += 1;

    await card.save();

    // Update deck progress if status changed
    if (previousStatus !== result.status) {
      deck.studyProgress[previousStatus] -= 1;
      deck.studyProgress[result.status] += 1;
      deck.lastStudied = new Date();
      await deck.save();
    }

    res.status(200).json(card);
  } catch (error) {
    res.status(500).json({ message: 'Error reviewing card' });
  }
}; 