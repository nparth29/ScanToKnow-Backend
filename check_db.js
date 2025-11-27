// check_db.js
import dotenv from "dotenv";
dotenv.config();
import connectDB from "./config/db.js";
import Food from "./models/Food.js";
import AdditiveInfo from "./models/AdditiveInfo.js";
import IngredientsInfo from "./models/IngredientsInfo.js";

(async () => {
  try {
    await connectDB();
    const foodCount = await Food.countDocuments({});
    const f500 = await Food.findOne({ barcode: "5000112558272" }).lean();
    const f123 = await Food.findOne({ barcode: "1234567890123" }).lean();
    const addCount = await AdditiveInfo.countDocuments({});
    const ingCount = await IngredientsInfo.countDocuments({});

    console.log("foodCount:", foodCount);
    console.log("has 5000112558272?:", !!f500);
    console.log("has 1234567890123?:", !!f123);
    console.log("additives count:", addCount);
    console.log("ingredients docs:", ingCount);
  } catch (err) {
    console.error("CHECK_DB_ERROR:", err);
  } finally {
    process.exit(0);
  }
})();
