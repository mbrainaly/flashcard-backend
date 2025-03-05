"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const notes_controller_1 = require("../controllers/notes.controller");
const router = (0, express_1.Router)();
// Protected routes
router.use(auth_middleware_1.protect);
// Generation and saving routes (place these before generic routes)
router.post('/generate', notes_controller_1.generateNotes);
router.post('/save', notes_controller_1.saveNotes);
// CRUD routes
router.route('/')
    .get(notes_controller_1.getNotes)
    .post(notes_controller_1.createNote);
router.route('/:id')
    .get(notes_controller_1.getNote)
    .put(notes_controller_1.updateNote)
    .delete(notes_controller_1.deleteNote);
exports.default = router;
