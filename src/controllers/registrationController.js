import Registration from '../models/Registration.js';
import { v2 as cloudinary } from 'cloudinary'; 
import { Parser } from "json2csv";
import { uploadBufferToCloudinary } from '../utils/uploadToCloudinary.js'; 
import { v4 as uuidv4 } from 'uuid';
import path from 'path'; // ✅ path is now correctly imported
import Competition from '../models/Competition.js';

// Helper function to generate a unique registration ID
const generateRegistrationId = () => {
    // 1. Generate a random alphanumeric string (e.g., 'z9h7y6')
    //    - Math.random() is converted to base 36 (0-9, a-z).
    //    - substring(2) removes the leading '0.'
    //    - slice(0, 6) ensures exactly 6 characters.
    const randomAlphanumeric = Math.random().toString(36).substring(2).slice(0, 6);

    // 2. Combine the 'REG-' prefix and the random part, then convert all to uppercase.
    return `IICF-${randomAlphanumeric}`.toUpperCase();
};

// --- POST: Create New Registration (Cloudinary Implementation) ---
// Don't forget to import the Competition model


export const createRegistration = async (req, res) => {
  try {
    const data = req.cleanedFormData; 
    const passportFile = req.passportFile; 
    let passportFileUrl = undefined;

    // 0. ✅ GET COMPETITION DATA
    const competition = await Competition.findById(data.competition).select('passportRequired');
    
    if (!competition) {
        return res.status(404).json({ error: "Competition not found." });
    }
    const passportIsRequired = competition.passportRequired;

    // 1. ✅ HANDLE FILE SAVING (CLOUDARY) - ONLY IF PASSPORT IS REQUIRED
    if (passportIsRequired) {
        if (!passportFile) {
            // Optional: Add a check if the file is missing when required
            // return res.status(400).json({ error: "Passport file is required for this competition." });
        }
        
        if (passportFile) {
            const fullName = data.name.replace(/\s+/g, '_').toLowerCase(); 
            // NOTE: path.extname and uuidv4 need to be imported if they are not
            // import path from 'path'; 
            // import { v4 as uuidv4 } from 'uuid';
            const fileExtension = path.extname(passportFile.originalname);
            const uniqueFileName = `passport-${uuidv4()}${fileExtension}`;

            // NOTE: uploadBufferToCloudinary must be defined/imported
            passportFileUrl = await uploadBufferToCloudinary(
                passportFile.buffer,
                uniqueFileName,
                fullName
            );
        }
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
            // Rejects new registration if payment is already complete
            return res.status(409).json({ 
                error: "A registration with this email, mobile, or Aadhaar already exists and is paid."
            });
        } 
        
        // Allows retry/proceed if payment is pending/failed (crucial for payment flow)
        return res.status(200).json({
            success: true,
            registration: exists,
            retryAllowed: true,
            message: "Existing pending registration found. Proceed to retry payment.",
        });
    }

    // 3. Create new registration 
    // Passport number is only saved if passportIsRequired is true
    const passportNumberToSave = passportIsRequired ? data.passportNumber : undefined;

    const newRegistration = new Registration({
        // registrationId: generateRegistrationId(), // NOTE: generateRegistrationId must be defined/imported
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        address: data.address,
        competitionCity: data.competitionCity,
        state: data.state,
        pin: data.pin,
        aadhaarNumber: cleanedAadhaar,
        competition: data.competition,
        competitionName: data.competitionName,
        // Conditional saving of passport details:
        passportNumber: passportNumberToSave, // Saves only if required
        passportFileUrl: passportFileUrl,     // Only set if required AND file was uploaded
        acceptedTerms: data.acceptedTerms === 'true', 
        amount: data.amount ? parseFloat(data.amount) : 0,
        paymentStatus: "pending", // Always pending upon creation
        workPlace: data.workPlace || "", 
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

// --- PATCH: Update Registration Status (Generic function used by Instamojo Webhook) ---
// ⚠️ Renamed from updateRegistrationPayment to be a generic status updater
export const updateRegistrationStatus = async (req, res) => {
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
            // For webhooks, we usually return 200/204 even if not found, 
            // but for a direct API call, 404 is appropriate.
            return res.status(404).json({ error: "Registration not found." });
        }

        res.json({ success: true, registration: updated });
    } catch (err) {
        console.error("❌ Registration Status Update Error:", err);
        res.status(500).json({ error: "Server error during payment status update.", details: err.message });
    }
};

// --- DELETE: Delete Registration By ID (Cleanup Modification) ---
export const deleteRegistrationById = async (req, res) => {
    try {
        const { id } = req.params; 
        const registration = await Registration.findById(id);
        
        if (!registration) return res.status(404).json({ error: "Registration not found." });

        // ⚠️ Cloudinary Deletion: Needs a separate utility call using the Cloudinary API.
        // For production, you'd use registration.passportFileUrl to extract the public_id and delete it.
        
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


/**
 * @route   GET /api/registration/export
 * @desc    Export all registrations (CSV)
 * @access  Admin / Internal
 */
export const exportRegistrationsCSV = async (req, res) => {
  try {
    // Optional filters from query
    const { competitionId, paymentStatus, startDate, endDate } = req.query;
    const filter = {};

    if (competitionId) filter.competition = competitionId;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Fetch data
    const registrations = await Registration.find(filter)
      .populate("competition", "name")
      .sort({ createdAt: -1 })
      .lean();

    if (!registrations.length) {
      return res.status(404).json({ message: "No registrations found." });
    }

    // Prepare for CSV export
    const formatted = registrations.map((r) => ({
      RegistrationID: r.registrationId || "",
      Name: r.name || "",
      Email: r.email || "",
      Mobile: r.mobile || "",
      Address: r.address || "",
      CompetitionCity: r.competitionCity || "",
      State: r.state || "",
      Pin: r.pin || "",
      AadhaarNumber: r.aadhaarNumber || "",
      CompetitionID: r.competition || "",
      CompetitionName: r.competitionName || (r.competition?.name || ""),
      WorkPlace: r.workPlace || "",
      PassportNumber: r.passportNumber || "",
      Amount: r.amount || 0,
      PaymentStatus: r.paymentStatus || "",
      PaymentId: r.paymentId || "",
      CreatedAt: r.createdAt
        ? new Date(r.createdAt).toLocaleString("en-IN")
        : "",
      UpdatedAt: r.updatedAt
        ? new Date(r.updatedAt).toLocaleString("en-IN")
        : "",
    }));

    const fields = Object.keys(formatted[0]);
    const json2csv = new Parser({ fields });
    const csv = json2csv.parse(formatted);

    res.header("Content-Type", "text/csv");
    res.attachment("registrations_report.csv");
    return res.send(csv);
  } catch (error) {
    console.error("❌ Error exporting registrations CSV:", error);
    return res
      .status(500)
      .json({ message: "Failed to export registrations", error: error.message });
  }
};
