import express from 'express';
import {
  getAllCompetitions,
  getCompetitionById,
  createCompetition,
  updateCompetition,
  deleteCompetition
} from '../controllers/competitionController.js'; // Adjust path as needed

const router = express.Router();

// Get all competitions (Replaces your original GET logic)
// GET /api/competitions
router.get('/competitions', getAllCompetitions);

// Get competition by ID
// GET /api/competitions/:id
router.get('/competitions/:id', getCompetitionById);

// Create a new competition
// POST /api/competitions
router.post('/competitions', createCompetition);

// Update competition (by ID)
// PUT /api/competitions/:id
router.put('/competitions/:id', updateCompetition);

// Delete competition (by ID)
// DELETE /api/competitions/:id
router.delete('/competitions/:id', deleteCompetition);

export default router;