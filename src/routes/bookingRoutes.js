import express from "express";
import { createBooking } from "../controllers/bookingController.js";
import { verifyToken, verifyCustomer } from "../middlewares/auth.js";


const router = express.Router();


// POST /api/bookings - Customer creates a new booking
router.post("/", verifyToken, verifyCustomer, createBooking);


export default router;