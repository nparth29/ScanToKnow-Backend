import mongoose from "mongoose";
import dotenv from "dotenv";
import ProductVariant from "../models/productVariant.model.js";

dotenv.config();

async function testRead() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const doc = await ProductVariant.findOne().lean();

    if (!doc) {
      console.log("❌ No product_variant found");
      return;
    }

    console.log("✅ ProductVariant document read successfully");
    console.log({
      title: doc.title,
      barcode: doc.barcodes?.[0],
      brand: doc.brand?.name,
      nova: doc.nova_group,
      health: doc.health_label,
      ingredientsCount: doc.ingredient_summary?.length,
      additivesCount: doc.additives?.length
    });

  } catch (err) {
    console.error("❌ ERROR:", err);
  } finally {
    await mongoose.disconnect();
  }
}

testRead();
