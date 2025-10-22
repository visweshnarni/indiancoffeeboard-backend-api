// models/VenueDate.js
import mongoose, { Schema } from "mongoose";

const VenueDateSchema = new Schema(
  {
    city: { type: String, required: true, unique: true, trim: true },
    venueDetails: { type: String, required: true }, // full string like "30th October to ..."
  },
  { timestamps: true }
);

const VenueDate = mongoose.model("VenueDate", VenueDateSchema);

export default VenueDate;
