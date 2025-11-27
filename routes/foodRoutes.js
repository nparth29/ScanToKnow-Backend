// routes/foodRoutes.js
import express from "express";
import { getFoods, getFoodByBarcode, getAlternatives } from "../controllers/foodController.js";
const router = express.Router();

router.get("/", getFoods);
router.get("/barcode/:barcode", getFoodByBarcode);
router.get("/:id/alternatives", getAlternatives);

export default router;
