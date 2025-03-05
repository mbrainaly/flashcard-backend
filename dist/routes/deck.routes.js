"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const deck_controller_1 = require("../controllers/deck.controller");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Public routes
router.get('/public', deck_controller_1.getPublicDecks);
// Protected routes
router.use(auth_1.protect);
router.route('/')
    .get(deck_controller_1.getDecks)
    .post(deck_controller_1.createDeck);
router.get('/search', deck_controller_1.searchDecks);
router.route('/:id')
    .get(deck_controller_1.getDeck)
    .put(deck_controller_1.updateDeck)
    .delete(deck_controller_1.deleteDeck);
exports.default = router;
//# sourceMappingURL=deck.routes.js.map