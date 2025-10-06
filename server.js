import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './src/config/db.js'; // Make sure this file uses process.env.MONGO_URI

// Routes
import competitionRoutes from './src/routes/competitionRoutes.js';
import registrationRoutes from './src/routes/registrationRoutes.js';
import paymentRoutes from './src/routes/paymentRoutes.js';

// ------------------------- Setup -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config(); // Load .env before using process.env

const app = express();

// ---------------------- Middleware -----------------------
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files (passports, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ------------------------ Routes ------------------------
app.use('/api/competitions', competitionRoutes);  // GET /api/competitions
app.use('/api/registration', registrationRoutes); // POST /api/registration
app.use('/api/payment', paymentRoutes);           // POST /api/payment/order, POST /api/payment

// Test route
app.get('/', (req, res) => {
  res.send('🏆 Indian Coffee Board Registration API is Running..........!!!!');
});

// ---------------------- Start Server --------------------
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ MongoDB Connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Server failed to start:', err.message);
    process.exit(1); // Exit on DB connection failure
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});

startServer();
