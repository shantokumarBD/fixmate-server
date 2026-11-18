import express from "express";
import {
  getAllServices,
  getServiceById,
  createService,
  getMyServices,
  updateService,
  deleteService,
} from "../controllers/serviceController.js";

import { verifyToken, verifyTechnician } from "../middlewares/auth.js";

const router = express.Router();

// ─── Public Routes
// ─── Public Routes

// GET /api/services
router.get("/", getAllServices);






// ─── Technician Protected Routes
// ─── Technician Protected Routes

// GET /api/services/my - Get all services owned by logged-in technician

router.get("/my", verifyToken, verifyTechnician, getMyServices);


// POST /api/services - Create a new service
router.post("/", verifyToken, verifyTechnician, createService);


// GET /api/services/:id - Get single service details
router.get("/:id", getServiceById);


// PATCH /api/services/:id - Update own service (technician only)
router.patch("/:id", verifyToken, verifyTechnician, updateService);


// DELETE /api/services/:id - Delete own service (technician only)
router.delete("/:id", verifyToken, verifyTechnician, deleteService);

export default router;
