import Registration from '../models/Registration.js';
import { v2 as cloudinary } from 'cloudinary'; // If needed for deletion, otherwise import upload utility
import { uploadBufferToCloudinary } from '../utils/uploadToCloudinary.js'; // ✅ Cloudinary Upload Utility
import { v4 as uuidv4 } from 'uuid';
import path from 'path'; // ✅ ADD THIS IMPORT


// Helper function to generate a unique registration ID
const generateRegistrationId = () => {
  return `CFC2025${Date.now()}`;
};

// --- POST: Create New Registration (Cloudinary Implementation) ---
export const createRegistration = async (req, res) => {
  try {
    const data = req.cleanedFormData; 
    const passportFile = req.passportFile; 
    let passportFileUrl = undefined;
    
    // 1. ✅ HANDLE FILE SAVING (CLOUDARY)
    if (passportFile) {
        // Create a user-friendly folder name (e.g., John_A_Doe)
        // Clean name and replace spaces with underscores
        const fullName = data.name.replace(/\s+/g, '_').toLowerCase(); 
        
        // Use original file extension
        const fileExtension = path.extname(passportFile.originalname);
        // Create a unique filename for Cloudinary
        const uniqueFileName = `passport-${uuidv4()}${fileExtension}`;

        // Upload the buffer from memory to Cloudinary
        passportFileUrl = await uploadBufferToCloudinary(
            passportFile.buffer,
            uniqueFileName,
            fullName
        );
        // passportFileUrl is the secure URL returned by Cloudinary
    }
    
    // 2. CHECK FOR EXISTING REGISTRATION 
    const cleanedAadhaar = data.aadhaarNumber.replace(/\s/g, "");

    const exists = await Registration.findOne({
      $or: [
        { email: data.email },
        { mobile: data.mobile },
        { aadhaarNumber: cleanedAadhaar },
      ],
    });

    if (exists) {
        if (exists.paymentStatus === "success") {
             // ⚠️ If file was uploaded, we might want to clean up Cloudinary here. (Advanced/optional)
            return res.status(409).json({ 
                error: "A registration with this email, mobile, or Aadhaar already exists and is paid."
            });
        } 
        
        return res.status(200).json({
            success: true,
            registration: exists,
            retryAllowed: true,
            message: "Existing pending registration found. Proceed to retry payment.",
        });
    }

    // 3. Create new registration 
    const newRegistration = new Registration({
        registrationId: generateRegistrationId(),
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        address: data.address,
        // 🛑 REMOVED 'city' as per schema update
        state: data.state,
        pin: data.pin,
        aadhaarNumber: cleanedAadhaar, // Store cleaned number
        competition: data.competition,
        competitionName: data.competitionName,
        passportNumber: data.passportNumber,
        passportFileUrl: passportFileUrl, // Store the Cloudinary URL
        acceptedTerms: data.acceptedTerms === 'true', 
        amount: data.amount ? parseFloat(data.amount) : 0, // Safe parsing
        paymentStatus: "pending", 
    });

    const savedRegistration = await newRegistration.save();

    res.status(201).json({ 
      success: true, 
      registration: savedRegistration, 
      retryAllowed: false 
    });

  } catch (err) {
    console.error("❌ Registration POST Error:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message, details: err.errors });
    }
    res.status(500).json({
      error: "Server error during registration.",
      details: err.message,
    });
  }
};

// --- GET: Get All Registrations (Admin Use) ---
export const getAllRegistrations = async (req, res) => {
    try {
        const registrations = await Registration.find({}).sort({ createdAt: -1 });
        res.status(200).json(registrations);
    } catch (error) {
        console.error("❌ Error fetching all registrations:", error);
        res.status(500).json({ error: "Failed to fetch registrations." });
    }
};

// --- GET: Get Registration By ID (Admin/Lookup Use) ---
export const getRegistrationById = async (req, res) => {
    try {
        const { id } = req.params; 
        const registration = await Registration.findById(id);

        if (!registration) {
            return res.status(404).json({ error: "Registration not found." });
        }
        res.status(200).json(registration);
    } catch (error) {
        console.error("❌ Error fetching registration by ID:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "Invalid registration ID format." });
        }
        res.status(500).json({ error: "Failed to fetch registration." });
    }
};

// --- PATCH: Update Payment Status (Used after Razorpay verification) ---
export const updateRegistrationPayment = async (req, res) => {
    try {
        const { registrationId, paymentStatus, paymentId } = req.body; 

        if (!registrationId || !paymentStatus) {
            return res.status(400).json({ error: "registrationId and paymentStatus are required" });
        }

        const updateFields = { paymentStatus, ...(paymentId && { paymentId }) };

        const updated = await Registration.findOneAndUpdate(
            { registrationId: registrationId },
            updateFields,
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Registration not found." });
        }

        res.json({ success: true, registration: updated });
    } catch (err) {
        console.error("❌ Registration PATCH Error:", err);
        res.status(500).json({ error: "Server error during payment status update.", details: err.message });
    }
};

// --- DELETE: Delete Registration By ID (Cleanup Modification) ---
export const deleteRegistrationById = async (req, res) => {
    try {
        const { id } = req.params; 

        const registration = await Registration.findById(id);
        if (!registration) {
            return res.status(404).json({ error: "Registration not found." });
        }

        // ✅ Cloudinary Cleanup (Requires a utility using cloudinary.uploader.destroy)
        // We assume you'll implement the actual Cloudinary deletion call here if needed
        // For now, local FS delete logic is removed as the file is on Cloudinary.
        
        await registration.deleteOne(); 
        res.status(200).json({ message: "Registration successfully deleted." });

    } catch (error) {
        console.error("❌ Error deleting registration by ID:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "Invalid registration ID format." });
        }
        res.status(500).json({ error: "Failed to delete registration." });
    }
};