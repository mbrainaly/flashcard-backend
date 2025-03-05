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
exports.searchDecks = exports.getPublicDecks = exports.deleteDeck = exports.updateDeck = exports.getDeck = exports.getDecks = exports.createDeck = void 0;
const Deck_1 = __importDefault(require("../models/Deck"));
const Card_1 = __importDefault(require("../models/Card"));
// @desc    Create a new deck
// @route   POST /api/decks
// @access  Private
const createDeck = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, tags, isPublic } = req.body;
        const deck = yield Deck_1.default.create({
            title,
            description,
            tags,
            isPublic,
            owner: req.user._id,
        });
        res.status(201).json(deck);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating deck' });
    }
});
exports.createDeck = createDeck;
// @desc    Get all decks for current user
// @route   GET /api/decks
// @access  Private
const getDecks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const decks = yield Deck_1.default.find({ owner: req.user._id })
            .sort({ updatedAt: -1 });
        res.status(200).json(decks);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching decks' });
    }
});
exports.getDecks = getDecks;
// @desc    Get a single deck
// @route   GET /api/decks/:id
// @access  Private
const getDeck = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const deck = yield Deck_1.default.findById(req.params.id);
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
        const cardStats = yield Card_1.default.aggregate([
            { $match: { deck: deck._id } },
            { $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                } }
        ]);
        // Calculate progress
        const stats = cardStats.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, { mastered: 0, learning: 0, new: 0 });
        deck.studyProgress = stats;
        res.status(200).json(deck);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching deck' });
    }
});
exports.getDeck = getDeck;
// @desc    Update a deck
// @route   PUT /api/decks/:id
// @access  Private
const updateDeck = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, tags, isPublic } = req.body;
        const deck = yield Deck_1.default.findById(req.params.id);
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
        const updatedDeck = yield deck.save();
        res.status(200).json(updatedDeck);
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating deck' });
    }
});
exports.updateDeck = updateDeck;
// @desc    Delete a deck
// @route   DELETE /api/decks/:id
// @access  Private
const deleteDeck = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const deck = yield Deck_1.default.findById(req.params.id);
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
        yield Card_1.default.deleteMany({ deck: deck._id });
        // Delete the deck
        yield deck.deleteOne();
        res.status(200).json({ message: 'Deck deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting deck' });
    }
});
exports.deleteDeck = deleteDeck;
// @desc    Get public decks
// @route   GET /api/decks/public
// @access  Public
const getPublicDecks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const decks = yield Deck_1.default.find({ isPublic: true })
            .sort({ updatedAt: -1 })
            .limit(20);
        res.status(200).json(decks);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching public decks' });
    }
});
exports.getPublicDecks = getPublicDecks;
// @desc    Search decks
// @route   GET /api/decks/search
// @access  Private
const searchDecks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { query, tags } = req.query;
        const searchQuery = {
            $or: [
                { owner: req.user._id },
                { isPublic: true }
            ]
        };
        if (query) {
            searchQuery.$or.push({ title: { $regex: query, $options: 'i' } }, { description: { $regex: query, $options: 'i' } });
        }
        if (tags) {
            searchQuery.tags = { $in: tags.split(',') };
        }
        const decks = yield Deck_1.default.find(searchQuery)
            .sort({ updatedAt: -1 })
            .limit(20);
        res.status(200).json(decks);
    }
    catch (error) {
        res.status(500).json({ message: 'Error searching decks' });
    }
});
exports.searchDecks = searchDecks;
//# sourceMappingURL=deck.controller.js.map