// models/Competition.js
import mongoose, { Schema } from "mongoose";

const CompetitionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    passportRequired: { type: Boolean, required: true, default: false },

    // 🆕 Add city field
    city: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // helps in case-insensitive search
    },
  },
  { timestamps: true }
);

const Competition = mongoose.model("Competition", CompetitionSchema);
export default Competition;
