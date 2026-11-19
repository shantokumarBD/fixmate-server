import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

// Export centralized Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);