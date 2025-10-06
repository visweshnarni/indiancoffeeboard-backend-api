import mongoose, { Schema } from "mongoose";

// The TypeScript interface (IRegistration) is removed in JavaScript, 
// as the structure is fully defined by the Mongoose Schema below.

// 1️⃣ Define schema
const RegistrationSchema = new Schema(
  {
    registrationId: { type: String, required: false, unique: true, index: true, default: null }, 
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    competitionCity: { type: String, required: true },
    state: { type: String, required: true },
    pin: { type: String, required: true },
    // Aadhaar number is a string field
    aadhaarNumber: { type: String, required: true }, 
    competition: { type: String, required: true }, // Competition ID
    workPlace: { type: String, required:true }, // Added workPlace field
    competitionName: { type: String },
    passportNumber: { type: String },
    // Storing the URL or path to the uploaded file as a String
    passportFileUrl: { type: String }, 
    acceptedTerms: { type: Boolean, required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
      required: true,
    },
    paymentId: { type: String },
  },
  { 
    // Add createdAt and updatedAt fields automatically
    timestamps: true 
  }
);

// 2️⃣ Define and Export the Model
// Note: We don't need explicit type casting here.
const Registration = mongoose.model("Registration", RegistrationSchema);

export default Registration;