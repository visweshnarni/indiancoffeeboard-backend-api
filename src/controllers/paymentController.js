import Registration from '../models/Registration.js';
import Competition from '../models/Competition.js';
import axios from 'axios';
import dotenv from 'dotenv';
import moment from "moment";
import { uploadBufferToCloudinary } from '../utils/uploadToCloudinary.js';
import path from 'path';
import sendEmailWithTemplate from "../utils/sendEmail.js"; 
import VenueDate from "../models/VenueDate.js";
// import sendEmailWithTemplate from "../utils/sendEmail.js"; // Import if you have this utility

// Load environment variables if not already loaded
if (process.env.NODE_ENV !== 'production') {
    dotenv.config({ path: './.env' });
}

// Use environment variables for configuration
const API_KEY = process.env.INSTAMOJO_PRIVATE_API_KEY;
const AUTH_TOKEN = process.env.INSTAMOJO_PRIVATE_AUTH_TOKEN;
const INSTAMOJO_URL = process.env.INSTAMOJO_API_ENDPOINT;
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL;

// --- Utility Functions ---
const generateRegistrationId = () => {
    // 1. Generate a random alphanumeric string (e.g., 'z9h7y6')
    //    - Math.random() is converted to base 36 (0-9, a-z).
    //    - substring(2) removes the leading '0.'
    //    - slice(0, 6) ensures exactly 6 characters.
    const randomAlphanumeric = Math.random().toString(36).substring(2).slice(0, 6);

    // 2. Combine the 'REG-' prefix and the random part, then convert all to uppercase.
    return `IICF-${randomAlphanumeric}`.toUpperCase();
};

const extractId = (val) => val ? val.replace(/\/$/, '').split('/').pop() : '';


// --- 1. Initiate Registration and Payment ---
export const registerAndPay = async (req, res) => {
    // Data from registrationUpload middleware
    const registrationData = req.cleanedFormData || {};
    const passportFile = req.passportFile;

    const {
        name, email, mobile, amount, competition: competitionId, aadhaarNumber
    } = registrationData;

    let savedRegistration;
    let passportFileUrl = null;

    try {
        // 1. Fetch Competition Details
        const competitionDoc = await Competition.findById(competitionId).select('name price passportRequired');
        if (!competitionDoc) {
            return res.status(404).json({ message: 'Competition not found.' });
        }
        
        // 2. CHECK FOR EXISTING REGISTRATION
        const cleanedAadhaar = aadhaarNumber ? aadhaarNumber.replace(/\s/g, "") : null;
        
        if (!cleanedAadhaar) {
            return res.status(400).json({ message: 'Aadhaar number is required.' });
        }

        const exists = await Registration.findOne({
            $or: [
                { email: email },
                { mobile: mobile },
                { aadhaarNumber: cleanedAadhaar },
            ],
        });

        if (exists) {
            if (exists.paymentStatus === "success") {
                return res.status(409).json({ 
                    error: "A registration with this email, mobile, or Aadhaar already exists and is paid."
                });
            }
        }
        
        // 3. Validation
        if (parseFloat(amount) !== competitionDoc.price) {
            return res.status(400).json({ message: 'Incorrect amount provided based on competition price.' });
        }
        
        const passportIsRequired = competitionDoc.passportRequired;

        // ✅ REMOVED: The strict validation block for passport file/number is gone.
        // The logic now treats `passportRequired: true` as "optional."
        // If the user provides a file, we process it; if not, we continue without error.

        // 4. Upload Passport File to Cloudinary (ONLY if it's actually provided)
        if (passportIsRequired && passportFile) {
            const sanitizedName = name.replace(/\s/g, '_');
            const filename = `${Date.now()}-passport${path.extname(passportFile.originalname)}`;
            // NOTE: uploadBufferToCloudinary must be defined/imported
            passportFileUrl = await uploadBufferToCloudinary(
                passportFile.buffer, filename, sanitizedName
            );
        }

        // 5. Create and Save Registration Record
        const passportNumberToSave = (passportIsRequired && registrationData.passportNumber) 
            ? registrationData.passportNumber 
            : undefined;

        const newRegistration = new Registration({
            ...registrationData,
            competitionName: competitionDoc.name,
            passportNumber: passportNumberToSave, // Will be undefined if not provided
            passportFileUrl: passportFileUrl,         // Will be null if not uploaded
            aadhaarNumber: cleanedAadhaar,
            amount: competitionDoc.price,
            paymentStatus: 'pending',
            workPlace: registrationData.workPlace || "",
        });

        savedRegistration = await newRegistration.save();

        // 6. Prepare Instamojo Payload
        const payload = {
            purpose: `Competition Reg: ${competitionDoc.name}`,
            amount: competitionDoc.price.toFixed(2),
            buyer_name: name,
            email: email,
            mobile: mobile,
            redirect_url: `${BACKEND_BASE_URL}/api/payment/callback?registration_id=${savedRegistration._id}`
        };

        // 7. Call Instamojo API
        const response = await axios.post(INSTAMOJO_URL, payload, {
            headers: {
                'X-Api-Key': API_KEY,
                'X-Auth-Token': AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            const payment_request = response.data.payment_request;
            savedRegistration.paymentId = payment_request.id;
            await savedRegistration.save();

            // 8. Send Instamojo payment URL to frontend
            res.status(200).json({
                message: 'Registration created. Redirecting to payment.',
                registrationId: savedRegistration._id,
                payment_url: payment_request.longurl
            });

        } else {
            savedRegistration.paymentStatus = 'failed';
            await savedRegistration.save();
            console.error('Instamojo API Error:', response.data.message);
            res.status(500).json({
                error: 'Instamojo API error',
                details: response.data.message || 'Payment initiation failed.'
            });
        }
    } catch (error) {
        if (savedRegistration && savedRegistration.paymentStatus === 'pending') {
            savedRegistration.paymentStatus = 'failed';
            await savedRegistration.save();
        }
        console.error('Registration/Payment initiation failed:', error.message);
        res.status(500).json({
            message: 'Server error during registration and payment initiation.',
            details: error.response ? error.response.data : error.message
        });
    }
};


// --- 2. Handle Callback with Server-side Verification (User Redirect) ---
// Ensure generateRegistrationId is available (if not, you need to import it or define it here)
// const generateRegistrationId = () => { /* ... your implementation ... */ }; 

export const handleCallback = async (req, res) => {
    // We extract the registration_id and the Instamojo parameters
    const { registration_id } = req.query;
    const { payment_request_id, payment_id, payment_status } = req.query;

    console.log('Instamojo Callback Received:', req.query);

    try {
        // 1. Find the Registration record
        const registration = await Registration.findById(registration_id);

        if (!registration) {
            console.error(`Callback Error: Registration ID ${registration_id} not found.`);
            return res.redirect(`${FRONTEND_BASE_URL}/registration-error?message=RegistrationNotFound`);
        }
        
        // Skip further processing if the registration is already marked as 'success'
        if (registration.paymentStatus === 'success' && registration.registrationId) {
             console.log(`Registration ${registration._id} already processed as success.`);
             return res.redirect(`${FRONTEND_BASE_URL}/registration-success?id=${registration._id}`);
        }

        let finalStatus = 'failed';

        // 2. Verify Payment via Instamojo API if a payment ID is present
        if (payment_id) {
            try {
                const verificationResponse = await axios.get(
                    `https://www.instamojo.com/api/1.1/payments/${payment_id}/`,
                    {
                        headers: { 'X-Api-Key': API_KEY, 'X-Auth-Token': AUTH_TOKEN }
                    }
                );

                const result = verificationResponse.data;

                if (result.success && result.payment) {
                    const verifiedPayment = result.payment;

                    // Normalized check: status is 'Credit' AND the request IDs match
                    const requestIdFromAPI = extractId(verifiedPayment.payment_request);
                    const requestIdFromCallback = extractId(payment_request_id);

                    if (
                        verifiedPayment.status === 'Credit' &&
                        requestIdFromAPI === requestIdFromCallback
                    ) {
                        finalStatus = 'success';
                        registration.paymentId = payment_id; // Store the actual payment ID
                    } else {
                        console.warn(`Payment ID ${payment_id} verification failed. Instamojo Status: ${verifiedPayment.status}.`);
                    }
                } else {
                    console.error('Instamojo API verification failed:', result.message || 'Unknown error');
                }
            } catch (apiError) {
                console.error('Instamojo API request failed during verification:', apiError.response ? apiError.response.data : apiError.message);
            }
        } else {
            // If payment_id is missing, the payment attempt failed or was cancelled by the user
            console.log('No payment_id in callback. Marking as failed.');
        }

        // 3. Update Status and Save
        registration.paymentStatus = finalStatus;

        

// inside your callback:
if (finalStatus === 'success') {

  if (!registration.registrationId) {
    registration.registrationId = generateRegistrationId();
    console.log(`✅ Payment SUCCESS. Generated Final Registration ID: ${registration.registrationId}`);
  }

  // 🏢 Fetch venue info from DB
  let venueInfo = "";
  try {
    const cityName = registration.competitionCity.toLowerCase();
    const venueRecord = await VenueDate.findOne({ city: cityName });

    if (venueRecord) {
      venueInfo = venueRecord.venueDetails;
    } else {
      venueInfo = `Venue details for ${registration.competitionCity} will be shared soon.`;
    }
  } catch (venueErr) {
    console.error("❌ Error fetching venue details:", venueErr);
    venueInfo = "Venue details unavailable.";
  }

  console.log(`Payment confirmed for Registration ${registration._id}. Sending confirmation email...`);

  try {
    await sendEmailWithTemplate({
      to: registration.email,
      name: registration.name,
      templateKey: "2518b.554b0da719bc314.k1.2223f750-a1cf-11f0-b228-cabf48e1bf81.199b3bd3345",
      mergeInfo: {
        participantName: registration.name,
        registrationId: registration.registrationId,
        competitionName: registration.competitionName,
        mobile: registration.mobile,
        amount: registration.amount.toFixed(2),
        paymentId: registration.paymentId,
        year: new Date().getFullYear(),
        venue: venueInfo, // ⭐️ NEW FIELD for ZeptoMail
      },
    });
  } catch (emailErr) {
    console.error("❌ Failed to send registration confirmation email:", emailErr);
  }
}

await registration.save();


        // 4. Redirect to Frontend
        const redirectUrl =
            finalStatus === 'success'
                ? `${FRONTEND_BASE_URL}/registration-success?id=${registration._id}`
                : `${FRONTEND_BASE_URL}/registration-failure?id=${registration._id}`;

        res.redirect(redirectUrl);

    } catch (error) {
        console.error('Fatal error during Instamojo callback processing:', error);
        res.redirect(`${FRONTEND_BASE_URL}/registration-error?message=InternalError`);
    }
};


// --- 3. Retry Payment Function (Adapted for Registration) ---
export const retryPayment = async (req, res) => {
    const { registrationId } = req.params; // Expecting registrationId in URL params

    try {
        // 1. Find the existing registration (which should have a 'failed' or 'pending' status)
        let registrationToRetry = await Registration.findById(registrationId);

        if (!registrationToRetry) {
            return res.status(404).json({ message: 'Registration record not found.' });
        }

        if (registrationToRetry.paymentStatus === 'success') {
            return res.status(400).json({ message: 'Payment is already successful for this registration.' });
        }

        // Check if competition still exists to get the name
        const competitionDoc = await Competition.findById(registrationToRetry.competition);

        if (!competitionDoc) {
            return res.status(404).json({ message: 'Associated competition not found.' });
        }

        // 2. IMPORTANT: Reset the status to 'pending' before initiating a new request
        registrationToRetry.paymentStatus = 'pending';
        // Clear old Instamojo Request ID, as a new one will be generated
        registrationToRetry.paymentId = undefined;
        await registrationToRetry.save();


        // 3. Prepare Instamojo Payload using saved registration data
        const payload = {
            purpose: `Competition Reg: ${competitionDoc.name} (Retry)`,
            amount: registrationToRetry.amount.toFixed(2),
            buyer_name: registrationToRetry.name,
            email: registrationToRetry.email,
            mobile: registrationToRetry.mobile,
            redirect_url: `${BACKEND_BASE_URL}/api/payment/callback?registration_id=${registrationToRetry._id}`
        };


        // 4. Call Instamojo API to create a NEW payment request
        const response = await axios.post(INSTAMOJO_URL, payload, {
            headers: {
                'X-Api-Key': API_KEY,
                'X-Auth-Token': AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            const payment_request = response.data.payment_request;

            // 5. Store the NEW Instamojo Request ID
            registrationToRetry.paymentId = payment_request.id;
            await registrationToRetry.save();

            // 6. Send the Instamojo payment URL to the client
            res.status(200).json({
                message: 'Payment retry initiated.',
                registrationId: registrationToRetry._id,
                payment_url: payment_request.longurl // Client should redirect here
            });
        } else {
            // If Instamojo fails the retry request
            registrationToRetry.paymentStatus = 'failed';
            await registrationToRetry.save();
            res.status(500).json({
                error: 'Instamojo API error on retry',
                details: response.data.message || 'Payment initiation failed.'
            });
        }
    } catch (error) {
        console.error('Payment retry failed:', error.message);
        res.status(500).json({
            message: 'Server error during payment retry.',
            details: error.response ? error.response.data : error.message
        });
    }
};