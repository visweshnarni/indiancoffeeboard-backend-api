import axios from 'axios';
import dotenv from 'dotenv';
import Registration from '../models/Registration.js';
import sendConfirmation from '../utils/sendConfirmation.js'; // ✅ Import sendConfirmation utility

dotenv.config();

const INSTAMOJO_API_URL = 'https://api.instamojo.com/v2/payment_requests/'; 

// --- POST: Initiate Payment and Get Redirect URL ---
export const initiateInstamojoPayment = async (req, res) => {
    const { registrationId, amount } = req.body;
    
    try {
        if (!registrationId || !amount) {
            return res.status(400).json({ error: "Missing registrationId or amount." });
        }
        
        const registration = await Registration.findOne({ registrationId });
        if (!registration) {
            return res.status(404).json({ error: "Registration not found." });
        }
        if (registration.paymentStatus === 'success') {
             return res.status(409).json({ error: "Payment already completed." });
        }

        // Construct URLs from .env variables
        const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/registration/status?registrationId=${registrationId}`;
        const webhookUrl = process.env.WEBHOOK_URL; // e.g., http://yourdomain.com/api/payment/webhook

        const payload = {
            purpose: `Competition Registration: ${registration.competitionName}`,
            amount: amount,
            buyer_name: registration.name,
            email: registration.email,
            phone: registration.mobile,
            redirect_url: redirectUrl,
            webhook: webhookUrl,
            allow_repeated_payments: false,
            custom_fields: {
                registration_id: registrationId
            }
        };

        const response = await axios.post(INSTAMOJO_API_URL, payload, {
            headers: {
                'Authorization': `Private-API-Key ${process.env.INSTAMOJO_PRIVATE_API_KEY}`,
                'Private-Auth-Token': process.env.INSTAMOJO_PRIVATE_AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        const paymentData = response.data;
        
        // Update the registration record with the Instamojo payment ID
        await Registration.updateOne(
            { registrationId },
            { $set: { instamojoPaymentId: paymentData.id, paymentStatus: 'pending' } }
        );

        res.json({ 
            success: true, 
            redirectUrl: paymentData.longurl,
            paymentRequestId: paymentData.id 
        });

    } catch (error) {
        console.error('Instamojo Initiation Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: "Failed to initiate Instamojo payment.", 
            details: error.response?.data || error.message 
        });
    }
};

// --- POST: Webhook Handler for Payment Status Update (Final Confirmation Point) ---
export const instamojoWebhook = async (req, res) => {
    const data = req.body;
    const paymentStatus = data.status; // 'Credit' or 'Failed'
    const instamojoPaymentId = data.payment_id;
    const registrationId = data.custom_fields.registration_id; 

    try {
        const registration = await Registration.findOne({ registrationId });

        if (!registration) {
            console.error(`Webhook error: Registration ID ${registrationId} not found.`);
            return res.status(404).end(); 
        }

        let newStatus = 'failed';
        // ⚠️ Instamojo returns amounts as strings. Ensure comparison is safe.
        // Also ensure you compare against the amount stored in the DB (registration.amount)
        if (paymentStatus === 'Credit' && data.amount === String(registration.amount)) {
            newStatus = 'success';
        }

        // 2. Update Database
        const updatedRegistration = await Registration.findOneAndUpdate(
            { registrationId },
            { 
                $set: { 
                    paymentStatus: newStatus,
                    paymentId: instamojoPaymentId // Store the actual payment ID
                } 
            },
            { new: true } // Return the updated document
        );

        // 3. ✅ SEND CONFIRMATION EMAIL IF SUCCESSFUL
        if (newStatus === 'success' && updatedRegistration) {
            try {
                // Pass all required data to generate PDF and send email
                await sendConfirmation({
                    name: updatedRegistration.name,
                    email: updatedRegistration.email,
                    mobile: updatedRegistration.mobile,
                    // 🛑 Using 'N/A' for city since it was removed from the schema.
                    // Replace with the chapter city if you have it elsewhere.
                    city: 'N/A', 
                    competitionName: updatedRegistration.competitionName,
                    registrationId: updatedRegistration.registrationId,
                    amount: updatedRegistration.amount,
                    paymentId: updatedRegistration.paymentId,
                });
            } catch (emailErr) {
                console.error("❌ Failed to send confirmation email:", emailErr);
                // Non-fatal error for the webhook—still return 200 to Instamojo
            }
        }

        // 4. Respond to Instamojo (MUST return 200/204 to confirm receipt)
        res.status(200).end();

    } catch (error) {
        console.error('Instamojo Webhook Processing Error:', error);
        res.status(500).end(); 
    }
};