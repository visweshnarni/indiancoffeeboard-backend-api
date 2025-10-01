import axios from 'axios';
import dotenv from 'dotenv';
import Registration from '../models/Registration.js';
import sendConfirmation from '../utils/sendConfirmation.js'; // ✅ Import sendConfirmation utility

dotenv.config();

const INSTAMOJO_API_URL = 'https://www.instamojo.com/api/1.1/payment-requests/'; 

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
        const webhookUrl = process.env.WEBHOOK_URL;

        const payload = {
            purpose: `Competition Registration: ${registration.competitionName}`,
            amount: amount,
            buyer_name: registration.name,
            email: registration.email,
            phone: registration.mobile,
            redirect_url: redirectUrl,
            webhook: webhookUrl,
            allow_repeated_payments: false,
            send_email: true,
            send_sms: true,
            custom_fields: {
                registration_id: registrationId
            }
        };

        // ✅ CORRECTED AUTH HEADERS
        // Add this debug logging to check your credentials (remove in production)
console.log('API Key exists:', !!process.env.INSTAMOJO_PRIVATE_API_KEY);
console.log('Auth Token exists:', !!process.env.INSTAMOJO_PRIVATE_AUTH_TOKEN);
console.log('API Key length:', process.env.INSTAMOJO_PRIVATE_API_KEY?.length);
console.log('Auth Token length:', process.env.INSTAMOJO_PRIVATE_AUTH_TOKEN?.length);
        const response = await axios.post(INSTAMOJO_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.INSTAMOJO_PRIVATE_API_KEY}`,
                'X-Api-Key': process.env.INSTAMOJO_PRIVATE_API_KEY,
                'X-Auth-Token': process.env.INSTAMOJO_PRIVATE_AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        const paymentData = response.data;
        
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
// --- POST: Webhook Handler with Signature Verification ---
export const instamojoWebhook = async (req, res) => {
    const data = req.body;
    
    // ✅ VERIFY WEBHOOK SIGNATURE
    const providedSignature = req.headers['x-instamojo-signature'];
    const salt = process.env.INSTAMOJO_SALT;
    
    if (!verifyWebhookSignature(data, providedSignature, salt)) {
        console.error('Webhook signature verification failed');
        return res.status(401).end();
    }

    const paymentStatus = data.status;
    const instamojoPaymentId = data.payment_id;
    const registrationId = data.custom_fields?.registration_id; 

    try {
        if (!registrationId) {
            console.error('Webhook error: No registration ID in custom fields');
            return res.status(400).end();
        }

        const registration = await Registration.findOne({ registrationId });

        if (!registration) {
            console.error(`Webhook error: Registration ID ${registrationId} not found.`);
            return res.status(404).end(); 
        }

        let newStatus = 'failed';
        if (paymentStatus === 'Credit' && parseFloat(data.amount) === parseFloat(registration.amount)) {
            newStatus = 'success';
        }

        const updatedRegistration = await Registration.findOneAndUpdate(
            { registrationId },
            { 
                $set: { 
                    paymentStatus: newStatus,
                    paymentId: instamojoPaymentId
                } 
            },
            { new: true }
        );

        // ✅ SEND CONFIRMATION EMAIL IF SUCCESSFUL
        if (newStatus === 'success' && updatedRegistration) {
            try {
                await sendConfirmation({
                    name: updatedRegistration.name,
                    email: updatedRegistration.email,
                    mobile: updatedRegistration.mobile,
                    city: 'N/A',
                    competitionName: updatedRegistration.competitionName,
                    registrationId: updatedRegistration.registrationId,
                    amount: updatedRegistration.amount,
                    paymentId: updatedRegistration.paymentId,
                });
            } catch (emailErr) {
                console.error("❌ Failed to send confirmation email:", emailErr);
            }
        }

        res.status(200).end();

    } catch (error) {
        console.error('Instamojo Webhook Processing Error:', error);
        res.status(500).end(); 
    }
};

// ✅ WEBHOOK SIGNATURE VERIFICATION FUNCTION
function verifyWebhookSignature(data, providedSignature, salt) {
    const crypto = require('crypto');
    
    // Create the expected signature
    const message = JSON.stringify(data);
    const expectedSignature = crypto
        .createHmac('sha1', salt)
        .update(message)
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
    );
}