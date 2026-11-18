import express from "express";
import {
  createBooking,
  getMyBookings,
  cancelBooking,
} from "../controllers/bookingController.js";
import { verifyToken, verifyCustomer } from "../middlewares/auth.js";

const router = express.Router();

// POST /api/bookings - Customer creates a new booking
router.post("/", verifyToken, verifyCustomer, createBooking);

// GET /api/bookings/my - Customer views own bookings
router.get("/my", verifyToken, verifyCustomer, getMyBookings);


// PATCH /api/bookings/:id/cancel - Customer cancels own booking
router.patch("/:id/cancel", verifyToken, verifyCustomer, cancelBooking);


export default router;
