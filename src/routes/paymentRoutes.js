import express from 'express';
import { initiateInstamojoPayment, instamojoWebhook } from '../controllers/paymentController.js';

const router = express.Router();

// POST /api/payment/initiate (Called by frontend after successful registration creation)
router.post('/initiate', initiateInstamojoPayment);

// POST /api/payment/webhook (Called by Instamojo server, MUST be public)
router.post('/webhook', express.urlencoded({ extended: true }), instamojoWebhook); 
// Note: Instamojo webhooks send data in x-www-form-urlencoded format, so we need a specific body parser here.

export default router;