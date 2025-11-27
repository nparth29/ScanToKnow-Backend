// controllers/ingredientController.js
import IngredientsInfo from "../models/IngredientsInfo.js";

/**
 * GET /api/ingredients/barcode/:barcode
 * Returns normalized ingredients info for a barcode.
 */
export const getIngredientsByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    if (!barcode) {
      return res.status(400).json({ ok: false, error: "barcode required" });
    }

    // Build candidates to handle stored barcodes as strings or numbers
    const candidates = [barcode];
    const asNum = Number(barcode);
    if (!Number.isNaN(asNum)) candidates.push(asNum);

    // Find a document where `barcodes` array contains any candidate
    const doc = await IngredientsInfo.findOne({ barcodes: { $in: candidates } }).lean();

    if (!doc) {
      // return consistent, frontend-friendly shape
      return res.json({
        ok: true,
        data: { product: null, ingredients: [], barcodes: [] }
      });
    }

    const normalized = {
      product: typeof doc.product === "undefined" ? null : doc.product,
      ingredients: Array.isArray(doc.ingredients)
        ? doc.ingredients.map(i => ({
            name: typeof i.name === "undefined" ? null : i.name,
            description: typeof i.description === "undefined" ? null : i.description,
            health_note: typeof i.health_note === "undefined" ? null : i.health_note,
            tag: typeof i.tag === "undefined" ? null : i.tag
          }))
        : [],
      barcodes: Array.isArray(doc.barcodes) ? doc.barcodes : []
    };

    return res.json({ ok: true, data: normalized });
  } catch (err) {
    console.error("getIngredientsByBarcode error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
