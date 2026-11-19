import express from "express";
import {
  getAllServices,
  getServiceById,
  createService,
  getMyServices,
  updateService,
  deleteService,
  toggleAvailability,
} from "../controllers/serviceController.js";

import { verifyToken, verifyTechnician } from "../middlewares/auth.js";

const router = express.Router();

// ─── Public Routes ───
// GET /api/services (with search, category, sort, and limit)
router.get("/", getAllServices);

// ─── Technician Protected Routes ───
// GET /api/services/my - Get all services owned by logged-in technician
router.get("/my", verifyToken, verifyTechnician, getMyServices);

// POST /api/services - Create a new service
router.post("/", verifyToken, verifyTechnician, createService);

// PATCH /api/services/:id/availability - Toggle availability without re-approval
router.patch("/:id/availability", verifyToken, verifyTechnician, toggleAvailability);

// GET /api/services/:id - Get single service details
router.get("/:id", getServiceById);

// PATCH /api/services/:id - Update own service (resets approval to pending)
router.patch("/:id", verifyToken, verifyTechnician, updateService);

// DELETE /api/services/:id - Delete own service
router.delete("/:id", verifyToken, verifyTechnician, deleteService);

export default router;