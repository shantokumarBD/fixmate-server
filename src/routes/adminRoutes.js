import express from "express";
import {
  getAllUsers,
  updateUserRole,
  getAllServicesForAdmin,
  updateServiceApproval,
  getAllBookingsForAdmin,
  getAdminStats,
} from "../controllers/adminController.js";
import { verifyToken, verifyAdmin } from "../middlewares/auth.js";

const router = express.Router();

// Apply Admin RBAC protection to all routes in this router
router.use(verifyToken, verifyAdmin);

// User Management
router.get("/users", getAllUsers);
router.patch("/users/:id/role", updateUserRole);

// Service Approval Management
router.get("/services", getAllServicesForAdmin);
router.patch("/services/:id/approval", updateServiceApproval);

// Bookings & Analytics
router.get("/bookings", getAllBookingsForAdmin);
router.get("/stats", getAdminStats);

export default router;