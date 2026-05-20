// src/routes/ocr.routes.js
import express from "express";
import multer from "multer";
import { scanOCR } from "../controllers/ocr.controller.js";

const router = express.Router();

// memory storage (no disk write)
const upload = multer({ storage: multer.memoryStorage() });

// POST /v1/ocr/scan
router.post("/scan", upload.single("image"), scanOCR);

export default router;
