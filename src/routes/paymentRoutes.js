import express from "express";

// Import all necessary functions from the unified controller
import {
  registerAndPay,
  handleCallback, // Handles user redirect AND server-side verification
  retryPayment, // Handles payment retry for failed registrations
} from "../controllers/paymentController.js";

// Assuming your middleware is here
import registrationUpload from "../middlewares/registrationUpload.js";

const router = express.Router();

// --- Note on Webhook Middleware ---
// Since we are NOT using a separate webhook endpoint, the express.urlencoded middleware
// is not strictly needed here, but keeping it won't hurt. Instamojo will now rely only
// on the redirect_url, which uses query parameters (req.query), not body parsing.

// --- 1. Initiate Registration & Payment ---
// POST /api/payment/register-and-pay
// Middleware handles file upload and basic validation first.
router.post("/register-and-pay", registrationUpload, registerAndPay);

// --- 2. Handle User Redirect & Verification ---
// GET /api/payment/callback
// Instamojo redirects the user's browser here (success or failure) to trigger verification.
router.get("/callback", handleCallback);

// --- 3. Retry Payment ---
// POST /api/payment/retry/:registrationId
// Allows the frontend to request a new payment link for a failed/pending registration.
router.post("/retry/:registrationId", retryPayment);

// --- Webhook Route REMOVED ---
// The original webhook route and the associated body-parsing middleware are removed
// as verification is now done inside handleCallback.
// If you leave the old route.use('/webhook', express.urlencoded...) it will throw an error
// if the /webhook route isn't defined, or if it's placed improperly.
// We remove the router.use('/webhook', ...) line as well for a cleaner setup.

export default router;
