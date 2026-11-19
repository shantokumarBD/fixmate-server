import express from "express";
import {
  createCheckoutSession,
  verifyPayment,
} from "../controllers/paymentController.js";
import { verifyToken, verifyCustomer } from "../middlewares/auth.js";

const router = express.Router();

// POST /api/payments/create-checkout-session - Customer creates Stripe checkout session
router.post("/create-checkout-session", verifyToken, verifyCustomer, createCheckoutSession);

// POST /api/payments/verify - Authenticated user verifies payment after redirect
router.post("/verify", verifyToken, verifyPayment);
export default router;