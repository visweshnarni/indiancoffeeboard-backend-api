import mongoose, { Schema } from "mongoose";

const CompetitionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }, // Added unique constraint
    price: { type: Number, required: true, min: 0 },
    // ✅ ADD NEW FIELD
    passportRequired: { type: Boolean, required: true, default: false }, 
  },
  {
    timestamps: true,
  }
);

const Competition = mongoose.model("Competition", CompetitionSchema);
export default Competition;