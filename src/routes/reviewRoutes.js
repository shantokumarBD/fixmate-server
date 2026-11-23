import express from "express";
import { submitReview, getServiceReviews } from "../controllers/reviewController.js";
import { verifyToken, verifyCustomer } from "../middlewares/auth.js";

const router = express.Router();

// ─── Protected Routes ───
// POST /api/reviews - Customer submits review for their completed & paid booking
router.post("/", verifyToken, verifyCustomer, submitReview);

// ─── Public Routes ───
// GET /api/reviews/service/:serviceId - Get public reviews for a service
router.get("/service/:serviceId", getServiceReviews);

export default router;
