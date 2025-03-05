"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewCard = exports.deleteCard = exports.updateCard = exports.getDueCards = exports.getCards = exports.createCard = void 0;
const Card_1 = __importDefault(require("../models/Card"));
const Deck_1 = __importDefault(require("../models/Deck"));
const spacedRepetition_1 = require("../utils/spacedRepetition");
// @desc    Create a new card
// @route   POST /api/decks/:deckId/cards
// @access  Private
const createCard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { deckId } = req.params;
        const { front, back, hints, examples, tags } = req.body;
        // Check if deck exists and user has access
        const deck = yield Deck_1.default.findById(deckId);
        if (!deck) {
            res.status(404).json({ message: 'Deck not found' });
            return;
        }
        if (deck.owner.toString() !== req.user._id.toString()) {
            res.status(403).json({ message: 'Not authorized to add cards to this deck' });
            return;
        }
        // Handle image upload
        const image = req.file ? `/uploads/cards/${req.file.filename}` : undefined;
        const card = yield Card_1.default.create(Object.assign({ deck: deckId, front,
            back, hints: hints || [], examples: examples || [], tags: tags || [], image, status: 'new', createdBy: req.user._id }, (0, spacedRepetition_1.initializeCard)()));
        // Update deck card count
        deck.totalCards += 1;
        deck.studyProgress.new += 1;
        yield deck.save();
        res.status(201).json({
            success: true,
            data: card,
        });
    }
    catch (error) {
        console.error('Error creating card:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating card',
        });
    }
});
exports.createCard = createCard;
// @desc    Get all cards in a deck
// @route   GET /api/decks/:deckId/cards
// @access  Private
const getCards = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const deck = yield Deck_1.default.findById(req.params.deckId);
        if (!deck) {
            res.status(404).json({ message: 'Deck not found' });
            return;
        }
        if (deck.owner.toString() !== req.user._id.toString() && !deck.isPublic) {
            res.status(403).json({ message: 'Not authorized to view these cards' });
            return;
        }
        const cards = yield Card_1.default.find({ deck: req.params.deckId })
            .sort({ createdAt: -1 });
        res.status(200).json(cards);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching cards' });
    }
});
exports.getCards = getCards;
// @desc    Get cards due for review
// @route   GET /api/decks/:deckId/cards/due
// @access  Private
const getDueCards = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const deck = yield Deck_1.default.findById(req.params.deckId);
        if (!deck) {
            res.status(404).json({ message: 'Deck not found' });
            return;
        }
        if (deck.owner.toString() !== req.user._id.toString()) {
            res.status(403).json({ message: 'Not authorized to review these cards' });
            return;
        }
        const now = new Date();
        const cards = yield Card_1.default.find({
            deck: req.params.deckId,
            nextReview: { $lte: now },
        }).sort({ nextReview: 1 });
        res.status(200).json(cards);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching due cards' });
    }
});
exports.getDueCards = getDueCards;
// @desc    Update a card
// @route   PUT /api/cards/:id
// @access  Private
const updateCard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { front, back, hints, examples, tags } = req.body;
        const card = yield Card_1.default.findById(id);
        if (!card) {
            res.status(404).json({
                success: false,
                message: 'Card not found',
            });
            return;
        }
        // Check if user owns the deck
        const deck = yield Deck_1.default.findById(card.deck);
        if (!deck || deck.owner.toString() !== req.user._id.toString()) {
            res.status(403).json({ message: 'Not authorized to update this card' });
            return;
        }
        // Handle image upload
        const image = req.file ? `/uploads/cards/${req.file.filename}` : card.image;
        card.front = front || card.front;
        card.back = back || card.back;
        card.hints = hints || card.hints;
        card.examples = examples || card.examples;
        card.tags = tags || card.tags;
        card.image = image;
        yield card.save();
        res.status(200).json({
            success: true,
            data: card,
        });
    }
    catch (error) {
        console.error('Error updating card:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating card',
        });
    }
});
exports.updateCard = updateCard;
// @desc    Delete a card
// @route   DELETE /api/cards/:id
// @access  Private
const deleteCard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const card = yield Card_1.default.findById(req.params.id);
        if (!card) {
            res.status(404).json({ message: 'Card not found' });
            return;
        }
        // Check if user owns the deck
        const deck = yield Deck_1.default.findById(card.deck);
        if (!deck || deck.owner.toString() !== req.user._id.toString()) {
            res.status(403).json({ message: 'Not authorized to delete this card' });
            return;
        }
        // Update deck card count and progress
        deck.totalCards -= 1;
        deck.studyProgress[card.status] -= 1;
        yield deck.save();
        yield card.deleteOne();
        res.status(200).json({ message: 'Card deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting card' });
    }
});
exports.deleteCard = deleteCard;
// @desc    Review a card
// @route   POST /api/cards/:id/review
// @access  Private
const reviewCard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { quality } = req.body;
        const card = yield Card_1.default.findById(req.params.id);
        if (!card) {
            res.status(404).json({ message: 'Card not found' });
            return;
        }
        // Check if user owns the deck
        const deck = yield Deck_1.default.findById(card.deck);
        if (!deck || deck.owner.toString() !== req.user._id.toString()) {
            res.status(403).json({ message: 'Not authorized to review this card' });
            return;
        }
        // Calculate next review
        const previousStatus = card.status;
        const result = (0, spacedRepetition_1.calculateNextReview)(quality, card.interval, card.easeFactor, card.repetitions);
        // Update card with new values
        card.interval = result.interval;
        card.easeFactor = result.easeFactor;
        card.nextReview = result.nextReview;
        card.lastReviewed = new Date();
        card.status = result.status;
        card.repetitions += 1;
        yield card.save();
        // Update deck progress if status changed
        if (previousStatus !== result.status) {
            deck.studyProgress[previousStatus] -= 1;
            deck.studyProgress[result.status] += 1;
            deck.lastStudied = new Date();
            yield deck.save();
        }
        res.status(200).json(card);
    }
    catch (error) {
        res.status(500).json({ message: 'Error reviewing card' });
    }
});
exports.reviewCard = reviewCard;
//# sourceMappingURL=card.controller.js.map