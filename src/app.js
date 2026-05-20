// src/app.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import dotenv from "dotenv";
dotenv.config();
import categoryRoutes from "./routes/category.routes.js";
import productRoutes from "./routes/product.routes.js";
import variantRoutes from "./routes/variant.routes.js";
import scanRoutes from "./routes/scan.routes.js";
import searchRoutes from "./routes/search.routes.js"; // ✅ ADDED
import ocrRoutes from "./routes/ocr.routes.js";

const app = express();

/* =====================================================
   GLOBAL URL SANITIZER (NEW FEATURE - SAFE ADDITION)
   ===================================================== */
app.use((req, res, next) => {
  try {
    let cleanUrl = decodeURIComponent(req.url);

    // remove BOM, zero-width chars, newlines, tabs
    cleanUrl = cleanUrl.replace(/[\u200B-\u200D\uFEFF\r\n\t]/g, "");

    req.url = cleanUrl;
  } catch (err) {
    // ignore malformed URI errors
  }
  next();
});

/* =======================
   EXISTING MIDDLEWARES
   ======================= */

// Security headers
app.use(helmet());

// Logging
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Body parsing
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("CORS: Origin not allowed"), false);
      }
    })
  );
} else {
  app.use(cors());
}

/* =======================
   HEALTH CHECKS
   ======================= */

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/ready", (req, res) => {
  res.json({ ready: true });
});

/* =======================
   ROUTES (UNCHANGED + SEARCH ADDED)
   ======================= */

app.use("/v1/categories", categoryRoutes);
app.use("/v1/products", productRoutes);
app.use("/v1/variants", variantRoutes);
app.use("/v1/scan", scanRoutes);
app.use("/v1/search", searchRoutes); // ✅ ADDED
// OCR ROUTE
app.use("/v1/ocr", ocrRoutes);

/* =======================
   404 FALLBACK
   ======================= */

app.use("/v1/*", (req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.originalUrl
  });
});

/* =======================
   GLOBAL ERROR HANDLER
   ======================= */

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const payload = {
    error: err.message || "Internal Server Error"
  };

  if (process.env.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }

  console.error("Unhandled error:", err.message);
  res.status(status).json(payload);
});

export default app;
