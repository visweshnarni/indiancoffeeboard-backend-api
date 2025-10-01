import express from 'express';
import { 
    createRegistration, 
    updateRegistrationPayment,
    getAllRegistrations, 
    getRegistrationById,
    deleteRegistrationById
} from '../controllers/registrationController.js';

import registrationUpload from '../middlewares/registrationUpload.js'; 

const router = express.Router();

// --- Public/Frontend Routes ---

// POST /api/registration (Create Registration with File Upload)
router.post('/registration', registrationUpload, createRegistration);

// PATCH /api/registration (Update Payment Status using custom registrationId)
router.patch('/registration', updateRegistrationPayment); 


// --- Admin Routes (Add Authorization Middleware Here if needed) ---

// GET /api/registration (Get All)
router.get('/registration', getAllRegistrations);

// GET /api/registration/:id (Get By Mongoose _id)
router.get('/registration/:id', getRegistrationById);

// DELETE /api/registration/:id (Delete By Mongoose _id)
router.delete('/registration/:id', deleteRegistrationById);

export default router;