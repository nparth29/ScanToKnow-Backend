// controllers/foodController.js
import Food from "../models/Food.js";
import IngredientsInfo from "../models/IngredientsInfo.js";
import AdditiveInfo from "../models/AdditiveInfo.js";

/* Helper to pick nutriment values from several possible keys used in dumps. */
function pickNutriment(n, candidates = []) {
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(n, key)) {
      const v = n[key];
      return (typeof v === "undefined") ? null : v;
    }
  }
  return null;
}

/* GET /api/food
   Simple list endpoint (paginated optional). */
export const getFoods = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10)));
    const page = Math.max(0, parseInt(req.query.page || "0", 10));
    const docs = await Food.find({})
      .skip(page * limit)
      .limit(limit)
      .lean();
    return res.json({ ok: true, data: docs });
  } catch (err) {
    console.error("getFoods error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

/* GET /api/food/barcode/:barcode
   Returns product (as-is except nutriments filtered) + ingredients + additives
*/
export const getFoodByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    if (!barcode) return res.status(400).json({ ok: false, error: "barcode required" });

    // allow string/number candidates
    const candidates = [barcode];
    const asNum = Number(barcode);
    if (!Number.isNaN(asNum)) candidates.push(asNum);

    const product = await Food.findOne({ barcode: { $in: candidates } }).lean();
    if (!product) return res.status(404).json({ ok: false, error: "product not found" });

    // build nutriments filtered object
    const raw = product.nutriments || {};
    const nutrimentsFiltered = {
      energy_kcal: pickNutriment(raw, ["energy-kcal", "energy-kcal_value", "energy-kcal_100g", "energy_kcal", "energy-kcal_value"]),
      carbohydrates_g: pickNutriment(raw, ["carbohydrates", "carbohydrates_100g", "carbohydrates_value", "carbohydrates_g"]),
      sugars_g: pickNutriment(raw, ["sugars", "sugars_100g", "sugars_value", "sugars_g"]),
      fat_g: pickNutriment(raw, ["fat", "fat_100g", "fat_value", "fat_g"]),
      saturated_fat_g: pickNutriment(raw, ["saturated-fat", "saturated-fat_100g", "saturated-fat_value", "saturated_fat_g"]),
      proteins_g: pickNutriment(raw, ["proteins", "proteins_100g", "proteins_value", "proteins_g"]),
      salt_g: pickNutriment(raw, ["salt", "salt_100g", "salt_value", "salt_g"])
    };

    ['fat_g','saturated_fat_g','salt_g'].forEach(k => {
      if (nutrimentsFiltered[k] === 0) nutrimentsFiltered[k] = null;
    });

    // ingredients doc where barcodes array contains barcode
    const ingDoc = await IngredientsInfo.findOne({ barcodes: { $in: candidates } }).lean();
    const ingredients = (ingDoc && Array.isArray(ingDoc.ingredients)) ? ingDoc.ingredients : [];

    // additives lookup (preserve DB fields exactly)
    const additiveCodes = Array.isArray(product.additives) ? product.additives.map(c => String(c).trim().toLowerCase()).filter(Boolean) : [];
    let additives = [];
    if (additiveCodes.length) {
      const docs = await AdditiveInfo.find({ code: { $in: additiveCodes } }).lean();
      const map = new Map(docs.map(d => [String(d.code).toLowerCase(), d]));
      additives = additiveCodes.map(c => map.get(c)).filter(Boolean);
    }

    const productOut = { ...product, nutriments: nutrimentsFiltered };
    return res.json({ ok: true, product: productOut, ingredients, additives });
  } catch (err) {
    console.error("getFoodByBarcode error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

/* GET /api/food/:id/alternatives
   Return simple "healthier" alternatives within same category.
   This is a lightweight placeholder: it finds other products sharing any category,
   orders by nutriscore (A best -> E worst) if present, then returns top N.
*/
export const getAlternatives = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || "5", 10)));

    // find original product by _id or barcode
    let original = null;
    // try as ObjectId fallback or barcode
    original = await Food.findOne({ _id: id }).lean().catch(() => null);
    if (!original) {
      original = await Food.findOne({ barcode: id }).lean();
    }
    if (!original) return res.status(404).json({ ok: false, error: "product not found" });

    const cats = Array.isArray(original.categories) ? original.categories : [];
    if (!cats.length) return res.json({ ok: true, data: [] });

    // find other products sharing categories, exclude original
    const candidates = await Food.find({
      _id: { $ne: original._id },
      categories: { $in: cats }
    }).lean();

    // Score by nutriscore if present (A best -> E worst). We'll convert A..E to 1..5 (A=1).
    const scoreFromNutri = (n) => {
      if (!n) return 999;
      const s = String(n).toUpperCase();
      const map = { A: 1, B: 2, C: 3, D: 4, E: 5 };
      return map[s] ?? 999;
    };

    const sorted = candidates
      .map(p => ({ p, score: scoreFromNutri(p.nutriscore) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, limit)
      .map(x => x.p);

    return res.json({ ok: true, data: sorted });
  } catch (err) {
    console.error("getAlternatives error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
