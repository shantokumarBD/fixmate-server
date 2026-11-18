import express from "express";
import {
  getAllServices,
  getServiceById,
  createService,
} from "../controllers/serviceController.js";

import { verifyToken, verifyTechnician } from "../middlewares/auth.js";

const router = express.Router();

// ─── Public Routes
// ─── Public Routes

// GET /api/services
router.get("/", getAllServices);

// GET /api/services/:id
router.get("/:id", getServiceById);

// ─── Technician Protected Routes
// ─── Technician Protected Routes

// POST /api/services - Only logged-in technicians can create services
router.post("/", verifyToken, verifyTechnician, createService);

export default router;
