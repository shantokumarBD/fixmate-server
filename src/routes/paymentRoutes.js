import express from "express";
import {
  createCheckoutSession,
  verifyPayment,
  getMyPayments,
} from "../controllers/paymentController.js";
import { verifyToken, verifyCustomer } from "../middlewares/auth.js";

const router = express.Router();

// GET /api/payments/my - Customer views their own payment history
router.get("/my", verifyToken, verifyCustomer, getMyPayments);

// POST /api/payments/create-checkout-session - Customer creates Stripe checkout session
router.post(
  "/create-checkout-session",
  verifyToken,
  verifyCustomer,
  createCheckoutSession
);

// GET /api/payments/verify?session_id=... - Verify payment after Stripe redirect (PDF Standard)
router.get("/verify", verifyToken, verifyPayment);

// POST /api/payments/verify - Fallback verify with body { sessionId }
router.post("/verify", verifyToken, verifyPayment);

export default router;