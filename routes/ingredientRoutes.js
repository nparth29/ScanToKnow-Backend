// routes/ingredientRoutes.js
import express from "express";
import { getIngredientsByBarcode } from "../controllers/ingredientController.js";
const router = express.Router();

router.get("/barcode/:barcode", getIngredientsByBarcode);

export default router;
