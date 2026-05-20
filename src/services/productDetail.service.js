// // src/services/productDetail.service.js


import mongoose from "mongoose";
import Product from "../models/product.model.js";
import ProductVariant from "../models/productVariant.model.js";
import Ingredient from "../models/ingredient.model.js";
import Additive from "../models/additive.model.js";
import Category from "../models/category.model.js";

/* -------------------- helpers -------------------- */

function toObjectId(id) {
  if (!id) return null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return null;
}

async function buildBreadcrumbForCategory(catId) {
  if (!catId) return [];
  const breadcrumb = [];
  let cur = await Category.findById(catId)
    .select("_id name slug parent_id")
    .lean();

  const seen = new Set();
  while (cur && !seen.has(String(cur._id))) {
    breadcrumb.unshift({
      id: cur._id,
      name: cur.name,
      slug: cur.slug || null
    });
    seen.add(String(cur._id));
    if (cur.parent_id) {
      cur = await Category.findById(cur.parent_id)
        .select("_id name slug parent_id")
        .lean();
    } else break;
  }
  return breadcrumb;
}

async function resolveIngredientSummaryEntry(item) {
  if (!item) return null;

  let info = null;
  if (item.ingredient_id) {
    info = await Ingredient.findById(item.ingredient_id).lean();
  }

  if (!info && item.name) {
    const escaped = item.name
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^${escaped}$`, "i");

    info = await Ingredient.findOne({
      $or: [{ canonical_name: regex }, { aliases: regex }]
    }).lean();
  }

  return {
    ingredient_id: info ? info._id : item.ingredient_id || null,
    name_in_text: item.name || null,
    canonical_name: info ? info.canonical_name : item.name || null,
    percentage:
      item.percentage === undefined || item.percentage === null
        ? null
        : item.percentage,
    health_rating: info ? info.health_rating || null : null,
    source_tag: info ? info.source_tag || null : null,
    description: info ? info.description || null : null
  };
}

async function resolveAdditiveEntry(addRef) {
  if (!addRef) return null;

  const code =
    addRef.code || (addRef._id ? String(addRef._id) : null);

  let info = null;
  if (code) {
    info = await Additive.findOne({ code }).lean();
  }

  if (!info && addRef._id && mongoose.Types.ObjectId.isValid(addRef._id)) {
    info = await Additive.findById(addRef._id).lean();
  }

  return {
    code: info ? info.code : code || null,
    name: info ? info.name : null,

    // ✅ ADDED
    description: info ? info.description || null : null,

    // ✅ ADDED
    source_tag: info ? info.source_tag || null : null,

    percentage:
      addRef.percentage === undefined || addRef.percentage === null
        ? null
        : addRef.percentage,
    confidence:
      addRef.confidence === undefined || addRef.confidence === null
        ? null
        : addRef.confidence,
    health_rating: info ? info.health_rating || null : null,
    notes: info ? info.notes || null : null,
    synonyms: info ? info.synonyms || [] : []
  };
}

/* -------------------- DTO assembly -------------------- */

async function assembleVariantDTO(variantDoc) {
  if (!variantDoc) return null;

  let parent = null;
  if (variantDoc.parent_product_id) {
    parent = await Product.findById(variantDoc.parent_product_id)
      .select("_id product_name variant_ids")
      .lean();
  }

  let siblings = [];
  if (parent?.variant_ids?.length) {
    const raw = await ProductVariant.find({
      parent_product_id: parent._id
    })
      .select(
        "_id title sku barcodes quantity_value quantity_unit images.front"
      )
      .lean();

    siblings = raw.map(v => ({
      id: v._id,
      title: v.title,
      sku: v.sku,
      barcode: v.barcodes?.[0] || null,
      quantity_value: v.quantity_value || null,
      quantity_unit: v.quantity_unit || null,
      image: v.images?.front || null
    }));
  }

  const ingredients = [];
  for (const i of variantDoc.ingredient_summary || []) {
    const r = await resolveIngredientSummaryEntry(i);
    if (r) ingredients.push(r);
  }

  const additives = [];
  for (const a of variantDoc.additives || []) {
    const r = await resolveAdditiveEntry(a);
    if (r) additives.push(r);
  }

  let categories = [];
  if (variantDoc.category_ids?.length) {
    categories = await buildBreadcrumbForCategory(
      variantDoc.category_ids[0]
    );
  }

  return {
    id: variantDoc._id,
    sku: variantDoc.sku || null,
    title: variantDoc.title || null,
    barcodes: variantDoc.barcodes || [],
    images: variantDoc.images || {},
    brand: variantDoc.brand?.name || null,
    parent_product: parent
      ? { id: parent._id, name: parent.product_name, variants: siblings }
      : null,
    quantity_value: variantDoc.quantity_value || null,
    quantity_unit: variantDoc.quantity_unit || null,
    categories,
    nutriments: variantDoc.nutriments || {},
    nutri_score: variantDoc.nutri_score || null,
    nova_group: variantDoc.nova_group || null,
    cphs_final: variantDoc.cphs_final ?? null,
    health_label: variantDoc.health_label ?? null,
    health_stars: variantDoc.health_stars ?? null,
    ingredient_summary: ingredients,
    additives,
    tags: [],
    scan_stats: variantDoc.scan_stats || {
      total_scans: 0,
      last_scanned: null
    }
  };
}

/* -------------------- public APIs -------------------- */

export async function getVariantDetailByBarcode(barcode) {
  if (!barcode) return null;

  let normalized = String(barcode);
  if (normalized.normalize) {
    normalized = normalized.normalize("NFKC");
  }
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

  let variant = await ProductVariant.findOne({
    barcodes: { $in: [normalized] }
  }).lean();

  if (!variant) return null;

  const dto = await assembleVariantDTO(variant);
  return { dto, variantDoc: variant };
}

export async function getVariantDetailById(variantId) {
  if (!variantId) return null;
  const _id = toObjectId(variantId) || variantId;
  const variant = await ProductVariant.findById(_id).lean();
  if (!variant) return null;
  return assembleVariantDTO(variant);
}

export async function getProductDetailById(productId) {
  if (!productId) return null;
  const _id = toObjectId(productId) || productId;
  const product = await Product.findById(_id).lean();
  if (!product) return null;

  const variants = await ProductVariant.find({
    parent_product_id: product._id
  }).lean();

  const dtoVariants = [];
  for (const v of variants) {
    const dto = await assembleVariantDTO(v);
    if (dto) dtoVariants.push(dto);
  }

  return {
    id: product._id,
    product_name: product.product_name,
    code: product.code || null,
    brand: product.brand || null,
    flavor_tags: product.flavor_tags || [],
    curated: product.curated || false,
    variants: dtoVariants
  };
}

export async function incrementVariantScanStats(variantId) {
  if (!variantId) return;
  const _id = toObjectId(variantId) || variantId;

  await ProductVariant.findByIdAndUpdate(_id, {
    $inc: { "scan_stats.total_scans": 1 },
    $set: { "scan_stats.last_scanned": new Date() }
  }).catch(e =>
    console.error("scan_stats update failed:", e.message)
  );
}
