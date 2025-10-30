import multer from 'multer';
import path from 'path';
import Competition from '../models/Competition.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (file.fieldname === 'passportFile') {
    if (['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Passport file must be a PDF or image (JPG/PNG)'), false);
    }
  } else {
    cb(null, true);
  }
};

const multerFields = [
  { name: 'passportFile', maxCount: 1 }
];

const REQUIRED_TEXT_FIELDS = [
  'name', 'email', 'mobile', 'address', 'state', 
  'pin', 'aadhaarNumber', 'competition', 'acceptedTerms', 'amount'
];

const registrationUpload = (req, res, next) => {
  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
  });

  upload.fields(multerFields)(req, res, async (err) => {
    
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

        // A. Required Text Fields Check
        for (const field of REQUIRED_TEXT_FIELDS) {
            if (!body[field]) {
                return res.status(400).json({ error: `Missing required field: ${field}` });
            }
        }
        
        // B. Dynamic Passport Requirement Check
        if (!competitionId) {
            return res.status(400).json({ error: "Competition ID is required for validation." });
        }
        
        const competition = await Competition.findById(competitionId);
        
        if (!competition) {
            return res.status(404).json({ error: "Invalid competition ID provided." });
        }
        
        const passportRequired = competition.passportRequired; 

        // C. Conditional File Check
        // ✅ THIS CHECK IS NOW REMOVED to make the passport optional.
        // The middleware no longer blocks requests without a passport file.
        // The controller will decide whether to process the file if it exists.
        /* if (passportRequired && !passportFile) {
            return res.status(400).json({ error: 'Passport file is required for this competition.' });
        }
        */
        
        // --- 3. Attach Cleaned Data to Request ---
        req.cleanedFormData = {};
        Object.keys(body).forEach(key => {
            req.cleanedFormData[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
        });

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