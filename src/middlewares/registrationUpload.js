import multer from 'multer';
import path from 'path';
import Competition from '../models/Competition.js'; // ✅ Import Competition Model

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

const storage = multer.memoryStorage();

// Allow common image types and PDF for passportFile
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (file.fieldname === 'passportFile') {
    if (['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Passport file must be a PDF or image (JPG/PNG)'), false);
    }
  } else {
    // Allow other fields to pass through
    cb(null, true);
  }
};

const multerFields = [
  { name: 'passportFile', maxCount: 1 }
];

// Define the non-optional fields needed for basic registration
const REQUIRED_TEXT_FIELDS = [
  'name', 'email', 'mobile', 'address', 'state', 
  'pin', 'aadhaarNumber', 'competition', 'acceptedTerms', 'amount' // ✅ Added 'amount'
];

/**
 * Middleware for handling Competition Registration form data and file upload.
 * It dynamically checks the database for the passport requirement.
 */
const registrationUpload = (req, res, next) => {
  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
  });

  // Use upload.fields() and wrap the handler in a promise/async function
  upload.fields(multerFields)(req, res, async (err) => { // ✅ Made handler 'async'
    
    // --- 1. Handle Multer Errors ---
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'The uploaded file must be under 5MB' });
    }
    if (err) {
      return res.status(400).json({ error: 'File upload error', details: err.message });
    }
    
    // --- 2. Validation and Cleanup ---
    try {
        const files = req.files || {};
        const passportFile = files.passportFile ? files.passportFile[0] : null;
        const body = req.body || {};
        const competitionId = body.competition; 

        // A. Required Text Fields Check (Including the competition ID)
        for (const field of REQUIRED_TEXT_FIELDS) {
            if (!body[field]) {
                return res.status(400).json({ error: `Missing required field: ${field}` });
            }
        }
        
        // B. Dynamic Passport Requirement Check
        if (!competitionId) {
            return res.status(400).json({ error: "Competition ID is required for validation." });
        }
        
        // Fetch competition to get the passportRequired flag
        const competition = await Competition.findById(competitionId);
        
        if (!competition) {
            return res.status(404).json({ error: "Invalid competition ID provided." });
        }
        
        // ✅ Use the boolean flag from the database
        const passportRequired = competition.passportRequired; 

        // C. Conditional File Check
        if (passportRequired && !passportFile) {
            return res.status(400).json({ error: 'Passport file is required for this competition.' });
        }
        
        // --- 3. Attach Cleaned Data to Request ---
        
        // Clean text fields
        req.cleanedFormData = {};
        Object.keys(body).forEach(key => {
            req.cleanedFormData[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
        });

        // Attach file buffer and metadata (only if a file was provided)
        if (passportFile) {
            req.passportFile = passportFile;
        }

        next();
    } catch (error) {
        console.error("❌ Middleware validation error:", error);
        res.status(500).json({ error: "Server processing error during registration validation." });
    }
  });
};

export default registrationUpload;