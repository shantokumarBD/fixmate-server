import express from "express";
import cors from "cors";

import serviceRoutes from "./routes/serviceRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { handleStripeWebhook } from "./controllers/paymentController.js";

const app = express();

// Middlewares - CORS
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);

// 1. Stripe Webhook (MUST be mounted BEFORE express.json() for raw buffer body)
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// 2. Standard JSON Body Parser for all other endpoints
app.use(express.json());

// Root Route
app.get("/", (req, res) => {
  res.send("FixMate server is running smoothly!....");
});

// 3. API Routers
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

export default app;