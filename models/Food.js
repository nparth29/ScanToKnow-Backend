// models/Food.js
import mongoose from "mongoose";

const NutrimentsSchema = new mongoose.Schema({}, { strict: false, _id: false });

const FoodSchema = new mongoose.Schema({
  barcode: { type: String, index: true, sparse: true },
  product_name: { type: String, required: true },
  brands: { type: String },
  quantity: { type: String },
  packaging: [String],
  categories: [String],
  labels: [String],
  additives: [String],        // e.g. ["e150d","e338"]
  allergens: [String],
  traces: [String],
  nutriscore: String,
  nova_group: Number,
  ecoscore: mongoose.Schema.Types.Mixed,
  nutriments: { type: NutrimentsSchema, default: {} },
  images: {
    front: String,
    ingredients: String,
    nutrition: String
  },
  last_updated: { type: Date, default: Date.now }
}, { timestamps: true });

// Explicit collection name if you want to be safe (optional if it already works)
export default mongoose.models.Food || mongoose.model("Food", FoodSchema, "food");
