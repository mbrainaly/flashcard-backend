"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Quiz = exports.Card = exports.Deck = exports.User = exports.Note = void 0;
var note_model_1 = require("./note.model");
Object.defineProperty(exports, "Note", { enumerable: true, get: function () { return __importDefault(note_model_1).default; } });
var User_1 = require("./User");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return __importDefault(User_1).default; } });
var Deck_1 = require("./Deck");
Object.defineProperty(exports, "Deck", { enumerable: true, get: function () { return __importDefault(Deck_1).default; } });
var Card_1 = require("./Card");
Object.defineProperty(exports, "Card", { enumerable: true, get: function () { return __importDefault(Card_1).default; } });
var Quiz_1 = require("./Quiz");
Object.defineProperty(exports, "Quiz", { enumerable: true, get: function () { return __importDefault(Quiz_1).default; } });
