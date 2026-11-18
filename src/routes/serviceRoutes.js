import express from "express";
import {
  getAllServices,
  getServiceById,
  createService,
  getMyServices,
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




export default router;
