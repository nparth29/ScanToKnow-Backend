// models/IngredientsInfo.js
import mongoose from "mongoose";

const IngredientItem = new mongoose.Schema({
  name: String,
  description: String,
  health_note: String,
  tag: String
}, { _id: false });

const IngredientsInfoSchema = new mongoose.Schema({
  product: String,
  ingredients: [IngredientItem],
  // allow mixed types because some dumps have numbers or strings
  barcodes: [mongoose.Schema.Types.Mixed]
}, { timestamps: true });

// ensure using correct collection name used in Compass/Atlas
export default mongoose.models.IngredientsInfo ||
  mongoose.model("IngredientsInfo", IngredientsInfoSchema, "ingredient_info");
