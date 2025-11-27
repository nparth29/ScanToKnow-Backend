// // controllers/additiveController.js
// import AdditiveInfo from "../models/AdditiveInfo.js";

// /**
//  * GET /api/additives?codes=e150d,e338
//  * Returns additive info for requested codes (case-insensitive, ordered).
//  * IMPORTANT: do NOT modify or trim the `description` or `health_note` fields.
//  */
// export const getAdditivesByCodes = async (req, res) => {
//   try {
//     const codesRaw = (req.query.codes || "").toString();
//     const codes = codesRaw
//       .split(",")
//       .map(s => s.trim().toLowerCase())
//       .filter(Boolean);

//     if (!codes.length) {
//       return res.json({ ok: true, data: [] });
//     }

//     // Fetch matching additive docs (keep raw data)
//     const docs = await AdditiveInfo.find({ code: { $in: codes } }).lean();

//     // Build map keyed by lowercase code for ordering
//     const map = new Map(docs.map(d => [d.code.toLowerCase(), d]));

//     // Preserve request order, return only desired fields but keep description intact
//     const ordered = codes
//       .map(code => map.get(code))
//       .filter(Boolean)
//       .map(d => ({
//         code: d.code,
//         name: d.name ?? null,
//         tag: d.tag ?? null,
//         // Do NOT change or modify description / health_note - return exactly as stored
//         description: typeof d.description === "undefined" ? null : d.description,
//         health_note: typeof d.health_note === "undefined" ? null : d.health_note
//       }));

//     return res.json({ ok: true, data: ordered });
//   } catch (err) {
//     console.error("getAdditivesByCodes error:", err);
//     return res.status(500).json({ ok: false, error: err.message });
//   }
// };




// controllers/additiveController.js
import AdditiveInfo from "../models/AdditiveInfo.js";

/**
 * GET /api/additives?codes=e150d,e338
 * Returns additive info for requested codes (case-insensitive, ordered).
 * IMPORTANT: do NOT modify or trim the `description` or `health_note` fields.
 */
export const getAdditivesByCodes = async (req, res) => {
  try {
    const codesRaw = (req.query.codes || "").toString();
    const codes = codesRaw
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (!codes.length) {
      return res.json({ ok: true, data: [] });
    }

    // Fetch matching additive docs (we use $in on lowercase codes)
    // We do not change description or health_note here -- we return stored values.
    const docs = await AdditiveInfo.find({ code: { $in: codes } }).lean();

    // Build map keyed by lowercase code for ordering
    const map = new Map(docs.map(d => [String(d.code).toLowerCase(), d]));

    // Preserve request order; return the docs exactly as stored for those keys
    const ordered = codes
      .map(code => map.get(code))
      .filter(Boolean)
      // Return the stored doc fields exactly (don't mutate description/health_note)
      .map(d => ({
        // Keep the same shape but avoid accidentally mutating the original doc
        code: d.code,
        name: typeof d.name === "undefined" ? null : d.name,
        tag: typeof d.tag === "undefined" ? null : d.tag,
        description: typeof d.description === "undefined" ? null : d.description,
        health_note: typeof d.health_note === "undefined" ? null : d.health_note
      }));

    return res.json({ ok: true, data: ordered });
  } catch (err) {
    console.error("getAdditivesByCodes error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
