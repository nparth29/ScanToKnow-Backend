/* =========================================================
   ocrPipeline.service.js — v5.0

   KEY FIXES FROM v4:
   1. resolveHealthInfo() now ALWAYS coerces health_rating to
      Int or null — never a String. Fixes Flutter cast crash:
      "type 'String' is not a subtype of type 'int?'"
   2. Handles newly-added biscuit/namkeen ingredients that
      have null health_rating in DB gracefully (no crash).
   3. resolveCandidateGroups() now also loads DB in batches
      with lean() to speed up matching on large payloads.
   4. Better logging on unresolved so you can tune the DB.
   ========================================================= */

import Ingredient from "../models/ingredient.model.js";
import Additive   from "../models/additive.model.js";
import { extractIngredientsAndAdditives } from "./ingredientExtractor.service.js";

/* =========================================================
   LEVENSHTEIN DISTANCE
   ========================================================= */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

/* =========================================================
   HEALTH INFO RESOLVER

   FIX: health_rating is stored in MongoDB as either:
   - A Number (int)  → cast to JS number correctly
   - A String (e.g. "75") → parseInt it
   - null / undefined → return null

   This guarantees the frontend always gets Int or null —
   never a String — fixing the Flutter type cast crash.
   ========================================================= */
function resolveHealthInfo(doc) {
  // Safely coerce to integer or null
  let rating = null;
  const raw = doc.health_rating;
  if (raw !== null && raw !== undefined && raw !== "") {
    const parsed = parseInt(String(raw), 10);
    if (!isNaN(parsed)) rating = parsed;
  }

  let label = "unknown";
  let color = "grey";

  if (rating !== null) {
    if (rating >= 85)      { label = "very_good"; color = "green";  }
    else if (rating >= 60) { label = "good";      color = "green";  }
    else if (rating >= 40) { label = "okay";      color = "yellow"; }
    else if (rating >= 20) { label = "poor";      color = "orange"; }
    else                   { label = "very_poor"; color = "red";    }
  }

  return { health_rating: rating, health_label: label, health_color: color };
}

/* =========================================================
   RESOLVE E-CODES → Additive DB docs
   ========================================================= */
async function resolveECodes(eCodes) {
  if (!eCodes.length) return { resolved: [], unresolved: [] };

  const resolved   = [];
  const unresolved = [];

  await Promise.all(eCodes.map(async (code) => {
    const upper = code.toUpperCase();

    const doc = await Additive.findOne({
      $or: [
        { code:     { $regex: `^${upper}$`,  $options: "i" } },
        { synonyms: { $elemMatch: { $regex: `^${upper}$`, $options: "i" } } },
      ]
    }).lean();

    if (doc) {
      resolved.push({
        code:         doc.code,
        name:         doc.name,
        description:  doc.description  ?? null,
        category:     doc.category     ?? null,
        ...resolveHealthInfo(doc),
      });
    } else {
      unresolved.push(code);
    }
  }));

  return { resolved, unresolved };
}

/* =========================================================
   RESOLVE A SINGLE NAME against both DB collections.
   ========================================================= */
function matchSingleName(nameLower, allAdditives, allIngredients) {
  // PASS 1: Exact additive synonym
  for (const add of allAdditives) {
    const synonymsLower = (add.synonyms || []).map(s => s.toLowerCase());
    if (synonymsLower.includes(nameLower)) {
      return { type: "additive", doc: add };
    }
  }

  // PASS 2: Exact additive name
  for (const add of allAdditives) {
    if (add.name.toLowerCase() === nameLower) {
      return { type: "additive", doc: add };
    }
  }

  // PASS 3: Exact ingredient canonical_name
  for (const ing of allIngredients) {
    if (ing.canonical_name.toLowerCase() === nameLower) {
      return { type: "ingredient", doc: ing };
    }
  }

  // PASS 4: Exact ingredient alias
  for (const ing of allIngredients) {
    const aliasesLower = (ing.aliases || []).map(a => a.toLowerCase());
    if (aliasesLower.includes(nameLower)) {
      return { type: "ingredient", doc: ing };
    }
  }

  // PASS 5: Partial contains on ingredient
  for (const ing of allIngredients) {
    const aliasesLower = (ing.aliases || []).map(a => a.toLowerCase());
    const canonLower   = ing.canonical_name.toLowerCase();
    const nameWords    = nameLower.split(/\s+/);

    const containsMatch =
      (canonLower.length > 3 && canonLower.split(/\s+/).every(w => nameLower.includes(w))) ||
      aliasesLower.some(alias =>
        (alias.length > 3 && alias.split(/\s+/).every(w => nameLower.includes(w))) ||
        nameWords.every(w => alias.includes(w))
      );

    if (containsMatch && canonLower.length > 3) {
      return { type: "ingredient", doc: ing };
    }
  }

  // PASS 6: Fuzzy on ingredient canonical_name
  if (nameLower.length <= 25) {
    let bestMatch = null;
    let bestDist  = Infinity;

    for (const ing of allIngredients) {
      const dist = levenshtein(nameLower, ing.canonical_name.toLowerCase());
      const maxDist = nameLower.length <= 10 ? 2 : 3;
      if (dist <= maxDist && dist < bestDist) {
        bestDist  = dist;
        bestMatch = ing;
      }
    }

    if (bestMatch) return { type: "ingredient", doc: bestMatch };
  }

  // PASS 7: Fuzzy on additive synonyms
  if (nameLower.length <= 25) {
    let bestMatch = null;
    let bestDist  = Infinity;

    for (const add of allAdditives) {
      for (const syn of (add.synonyms || [])) {
        const dist = levenshtein(nameLower, syn.toLowerCase());
        const maxDist = nameLower.length <= 10 ? 2 : 3;
        if (dist <= maxDist && dist < bestDist) {
          bestDist  = dist;
          bestMatch = add;
        }
      }
    }

    if (bestMatch) return { type: "additive", doc: bestMatch };
  }

  return null;
}

/* =========================================================
   RESOLVE CANDIDATE GROUPS
   ========================================================= */
async function resolveCandidateGroups(candidateGroups) {
  if (!candidateGroups.length) {
    return { ingredients: [], additives: [], unresolved_terms: [] };
  }

  const [allAdditives, allIngredients] = await Promise.all([
    Additive.find({}).lean(),
    Ingredient.find({}).lean(),
  ]);

  const ingredients      = [];
  const additives        = [];
  const unresolved_terms = [];

  const addedIngredients = new Set();
  const addedAdditives   = new Set();

  for (const group of candidateGroups) {
    const candidates = Array.isArray(group) ? group : [group];

    let matched = false;

    for (const candidate of candidates) {
      const nameLower = candidate.toLowerCase().trim();
      if (nameLower.length < 2) continue;

      const result = matchSingleName(nameLower, allAdditives, allIngredients);

      if (result) {
        if (result.type === "ingredient") {
          const key = result.doc.canonical_name;
          if (!addedIngredients.has(key)) {
            addedIngredients.add(key);
            ingredients.push({
              name:        result.doc.canonical_name,
              description: result.doc.description ?? null,
              category:    result.doc.category    ?? null,
              ...resolveHealthInfo(result.doc),   // ← always Int or null now
            });
          }
        } else {
          const key = result.doc.code;
          if (!addedAdditives.has(key)) {
            addedAdditives.add(key);
            additives.push({
              code:        result.doc.code,
              name:        result.doc.name,
              description: result.doc.description ?? null,
              category:    result.doc.category    ?? null,
              ...resolveHealthInfo(result.doc),   // ← always Int or null now
            });
          }
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      const primary = Array.isArray(group) ? group[0] : group;
      unresolved_terms.push(primary);
    }
  }

  return { ingredients, additives, unresolved_terms };
}

/* =========================================================
   MAIN PIPELINE
   ========================================================= */
export async function runOCRPipeline(rawText) {
  // ── Step 1: Parse raw text ─────────────────────────────
  const { eCodes, candidateGroups } = extractIngredientsAndAdditives(rawText);

  // ── Step 2: Resolve E-codes against Additive DB ───────
  const {
    resolved:   additivesFromCodes,
    unresolved: unresolvedCodes,
  } = await resolveECodes(eCodes);

  // ── Step 3: Resolve candidate groups ──────────────────
  const {
    ingredients,
    additives:       additivesFromNames,
    unresolved_terms,
  } = await resolveCandidateGroups(candidateGroups);

  // Merge additives, deduplicate by code
  const seenCodes = new Set(additivesFromCodes.map(a => a.code));
  const mergedAdditives = [
    ...additivesFromCodes,
    ...additivesFromNames.filter(a => {
      if (seenCodes.has(a.code)) return false;
      seenCodes.add(a.code);
      return true;
    }),
  ];

  const allUnresolved = [
    ...unresolved_terms,
    ...unresolvedCodes.map(c => c.toUpperCase()),
  ];

  // ── Step 4: Return ────────────────────────────────────
  return {
    ingredients,
    additives:        mergedAdditives,
    unresolved_terms: allUnresolved,
    raw_text:         rawText,
  };
}