import express from "express";
import {
  createBooking,
  getMyBookings,
  cancelBooking,
  getTechnicianBookings,
  updateBookingStatus,
  getBookingById,
} from "../controllers/bookingController.js";
import {
  verifyToken,
  verifyCustomer,
  verifyTechnician,
} from "../middlewares/auth.js";

const router = express.Router();

// POST /api/bookings - Customer creates a new booking
router.post("/", verifyToken, verifyCustomer, createBooking);

// GET /api/bookings/my - Customer views own bookings
router.get("/my", verifyToken, verifyCustomer, getMyBookings);

// GET /api/bookings/technician - Technician views assigned bookings
router.get("/technician", verifyToken, verifyTechnician, getTechnicianBookings);

// GET /api/bookings/:id - Get single booking details
router.get("/:id", verifyToken, getBookingById);


// PATCH /api/bookings/:id/status - Technician updates booking status
router.patch("/:id/status", verifyToken, verifyTechnician, updateBookingStatus);


// PATCH /api/bookings/:id/cancel - Customer cancels own booking
router.patch("/:id/cancel", verifyToken, verifyCustomer, cancelBooking);

export default router;
