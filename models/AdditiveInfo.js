// models/AdditiveInfo.js
import mongoose from "mongoose";

const AdditiveSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: String,
  tag: String,
  description: String,
  health_note: String
}, { timestamps: true });

// explicit collection name
export default mongoose.models.AdditiveInfo ||
  mongoose.model("AdditiveInfo", AdditiveSchema, "additives_info");
