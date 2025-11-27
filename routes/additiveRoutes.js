// routes/additiveRoutes.js
import express from "express";
import { getAdditivesByCodes } from "../controllers/additiveController.js";
const router = express.Router();

router.get("/", getAdditivesByCodes);

export default router;
