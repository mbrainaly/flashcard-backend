import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { 
  createNote, 
  getNotes, 
  getNote, 
  updateNote, 
  deleteNote,
  generateNotes,
  saveNotes
} from '../controllers/notes.controller';

const router = Router();

// Protected routes
router.use(protect);

// Generation and saving routes (place these before generic routes)
router.post('/generate', generateNotes);
router.post('/save', saveNotes);

// CRUD routes
router.route('/')
  .get(getNotes)
  .post(createNote);

router.route('/:id')
  .get(getNote)
  .put(updateNote)
  .delete(deleteNote);

export default router; 