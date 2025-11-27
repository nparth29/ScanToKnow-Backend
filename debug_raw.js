// debug_raw.js
import dotenv from "dotenv";
dotenv.config();
import connectDB from "./config/db.js";
import IngredientsInfo from "./models/IngredientsInfo.js";
import AdditiveInfo from "./models/AdditiveInfo.js";

(async () => {
  try {
    await connectDB();

    console.log("=== IngredientsInfo docs containing barcode 5000112558272 ===");
    const ing = await IngredientsInfo.find({ barcodes: "5000112558272" }).lean();
    console.log(JSON.stringify(ing, null, 2));

    console.log("=== All IngredientsInfo docs (count / first 5) ===");
    const allIng = await IngredientsInfo.find({}).limit(50).lean();
    console.log("count:", allIng.length);
    console.log(JSON.stringify(allIng.slice(0, 5), null, 2));

    console.log("=== Additive docs for e150d,e338 ===");
    const adds = await AdditiveInfo.find({ code: { $in: ["e150d","e338"] } }).lean();
    console.log(JSON.stringify(adds, null, 2));
  } catch (err) {
    console.error("DEBUG_RAW_ERROR:", err);
  } finally {
    process.exit(0);
  }
})();
