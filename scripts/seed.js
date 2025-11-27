// // scripts/seed.js
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import connectDB from "../config/db.js";
// import Food from "../models/Food.js";
// import AdditiveInfo from "../models/AdditiveInfo.js";
// import IngredientsInfo from "../models/IngredientsInfo.js";

// dotenv.config();
// await connectDB();

// const sample1 = {
//   barcode: "1234567890123",
//   product_name: "Sample Fanta 500ml",
//   brands: "Fanta",
//   categories: ["beverages", "drinks", "colas"],
//   additives: ["e150d"],
//   nutriments: { energy_kcal: 170, sugars_g: 30 },
//   images: { front: "https://via.placeholder.com/200" }
// };

// const coca = {
//   barcode: "5000112558272",
//   product_name: "PET 50CL COCA COLA",
//   brands: "Coca-Cola",
//   quantity: "500 ml",
//   packaging: ["bottle"],
//   categories: ["beverages","carbonated drinks","sodas","non alcoholic beverages","colas","sweetened beverages"],
//   additives: ["e150d","e338"],
//   nutriscore: "e",
//   nova_group: 4,
//   nutriments: {
//     carbohydrates: 27,
//     carbohydrates_100g: 10.8,
//     energy: 439,
//     "energy-kcal": 105,
//     proteins: 0,
//     sugars: 27
//   },
//   images: {
//     front: "https://images.openfoodfacts.org/images/products/500/011/255/8272/front_fr.87.400.jpg",
//     ingredients: "https://images.openfoodfacts.org/images/products/500/011/255/8272/ingredients_fr.42.400.jpg",
//     nutrition: "https://images.openfoodfacts.org/images/products/500/011/255/8272/nutrition_fr.28.400.jpg"
//   }
// };

// const additives = [
//   { code: "e150d", name: "Caramel IV", tag: "colour", description: "Caramel color", health_note: "May affect hyperactivity" },
//   { code: "e338", name: "Phosphoric acid", tag: "acidulant", description: "Used to acidify drinks", health_note: "Tooth enamel erosion" }
// ];

// const ingredientsInfo = {
//   product: "PET 50CL COCA COLA",
//   ingredients: [
//     { name: "carbonated water", description: "", health_note: "", tag: "" },
//     { name: "sugar", description: "", health_note: "", tag: "" },
//     { name: "color (E150d)", description: "", health_note: "", tag: "" }
//   ],
//   barcodes: ["5000112558272"]
// };

// await Food.updateOne({ barcode: sample1.barcode }, { $set: sample1 }, { upsert: true });
// await Food.updateOne({ barcode: coca.barcode }, { $set: coca }, { upsert: true });

// for (const a of additives) {
//   await AdditiveInfo.updateOne({ code: a.code }, { $set: a }, { upsert: true });
// }

// await IngredientsInfo.updateOne({ barcodes: { $in: ["5000112558272"] } }, { $set: ingredientsInfo }, { upsert: true });

// console.log("Seed completed");
// process.exit(0);



// scripts/seed.js
// Data-driven seeder: reads JSON files and upserts Food, AdditiveInfo, IngredientsInfo
// Expected JSON filenames in project root:
//   - fooddb.food.json
//   - fooddb.additives_info.json
//   - fooddb.ingredient_info.json
//
// Usage: node scripts/seed.js
// (Make sure .env has your MONGO_URI)

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Food from "../models/Food.js";
import AdditiveInfo from "../models/AdditiveInfo.js";
import IngredientsInfo from "../models/IngredientsInfo.js";

dotenv.config();
await connectDB();

const base = process.cwd();
const files = {
  food: path.join(base, "fooddb.food.json"),
  additives: path.join(base, "fooddb.additives_info.json"),
  ingredients: path.join(base, "fooddb.ingredient_info.json")
};

const readJsonSafe = (p) => {
  if (!fs.existsSync(p)) {
    console.warn("WARN: dataset file not found:", p);
    return [];
  }
  try {
    const txt = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(txt);
    if (!Array.isArray(parsed)) {
      console.warn("WARN: JSON is not an array, expecting array of docs:", p);
      return [];
    }
    return parsed;
  } catch (err) {
    console.error("ERROR parsing JSON", p, err.message);
    return [];
  }
};

const upsertFoods = async (arr) => {
  let inserted = 0, updated = 0;
  for (const doc of arr) {
    if (!doc || !doc.barcode) continue;
    const filter = { barcode: doc.barcode };
    // upsert full doc as-is (preserve all keys)
    const res = await Food.findOneAndUpdate(filter, { $set: doc }, { upsert: true, new: true, setDefaultsOnInsert: true });
    if (res) {
      // best-effort heuristics for inserted vs updated:
      if (!res.createdAt || String(res.createdAt) === String(res.updatedAt)) inserted++;
      else updated++;
    }
  }
  return { inserted, updated };
};

const upsertAdditives = async (arr) => {
  let inserted = 0, updated = 0;
  for (const doc of arr) {
    if (!doc || !doc.code) continue;
    const code = String(doc.code).toLowerCase();
    const payload = { ...doc, code };
    const res = await AdditiveInfo.findOneAndUpdate({ code }, { $set: payload }, { upsert: true, new: true, setDefaultsOnInsert: true });
    if (res) {
      if (!res.createdAt || String(res.createdAt) === String(res.updatedAt)) inserted++;
      else updated++;
    }
  }
  return { inserted, updated };
};

const upsertIngredients = async (arr) => {
  let inserted = 0, updated = 0;
  for (const doc of arr) {
    if (!doc) continue;
    const barcodes = Array.isArray(doc.barcodes) ? doc.barcodes : (doc.barcode ? [doc.barcode] : []);
    if (!barcodes.length) continue;
    // match any existing doc that contains any of these barcodes
    const res = await IngredientsInfo.findOneAndUpdate(
      { barcodes: { $in: barcodes } },
      { $set: { ...doc, barcodes } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (res) {
      if (!res.createdAt || String(res.createdAt) === String(res.updatedAt)) inserted++;
      else updated++;
    }
  }
  return { inserted, updated };
};

(async () => {
  try {
    console.log("Seeding from files:");
    console.log(" -", files.food);
    console.log(" -", files.additives);
    console.log(" -", files.ingredients);

    const foods = readJsonSafe(files.food);
    const additives = readJsonSafe(files.additives);
    const ingredients = readJsonSafe(files.ingredients);

    console.log(`Loaded: foods=${foods.length}, additives=${additives.length}, ingredients=${ingredients.length}`);

    if (foods.length) {
      const r = await upsertFoods(foods);
      console.log("Foods:", r);
    } else {
      console.log("No food docs to upsert.");
    }

    if (additives.length) {
      const r = await upsertAdditives(additives);
      console.log("Additives:", r);
    } else {
      console.log("No additive docs to upsert.");
    }

    if (ingredients.length) {
      const r = await upsertIngredients(ingredients);
      console.log("Ingredients:", r);
    } else {
      console.log("No ingredient docs to upsert.");
    }

    console.log("Seed finished. Verify via API or debug scripts.");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    process.exit(0);
  }
})();
