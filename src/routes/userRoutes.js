import express from "express";
import { getMyProfile, updateProfile } from "../controllers/userController.js";
import { verifyToken } from "../middlewares/auth.js";

const router = express.Router();

// All user profile routes require authentication
router.use(verifyToken);

// GET /api/users/me - Get current user profile
router.get("/me", getMyProfile);

// PATCH /api/users/profile - Update profile info (name, phone, area, bio, image)
router.patch("/profile", updateProfile);

export default router;