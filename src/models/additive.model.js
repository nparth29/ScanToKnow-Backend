//src/models/additive.model.js

import mongoose from "mongoose";

const AdditiveSchema = new mongoose.Schema({
  code: { type: String, index: true },
  name: String,
  description: String,
  health_rating: Number,
  source_tag: String,
  notes: String,
  synonyms: [String],
  category: String
});

export default mongoose.model(
  "Additive",
  AdditiveSchema,
  "additives"
);
