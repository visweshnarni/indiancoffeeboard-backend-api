import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// ⚠️ ASSUMPTION: You need to implement your database connection function here.
// For Mongoose, we'll assume a file structure like:
// import connectDB from './src/config/db.js'; // Ensure this file handles Mongoose connection

import connectDB from './src/config/db.js';

// Import NEW routes for the Registration project
import competitionRoutes from './src/routes/competitionRoutes.js';
import registrationRoutes from './src/routes/registrationRoutes.js';
// import paymentRoutes from './src/routes/paymentRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Static folder for uploaded files (e.g., passports)
// Ensure your multer config points to this path!
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Competition Registration API Routes ---

// 1. Competition (GET /api/competitions)
app.use('/api', competitionRoutes); // Mounted at /api so routes inside can be /competitions

// 2. Registration (POST /api/registration)
app.use('/api', registrationRoutes); // Mounted at /api so routes inside can be /registration

// 3. Payment (POST /api/payment/order, POST /api/payment)
// app.use('/api/payment', paymentRoutes); // Mounted at /api/payment

// --- End of NEW Routes ---

app.get('/', (req, res) => res.send('🏆 Indian Coffee Board Registration API is Running..........!!!!'));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to the database
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();