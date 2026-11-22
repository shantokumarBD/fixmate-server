import express from "express";
import cors from "cors";

import serviceRoutes from "./routes/serviceRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { handleStripeWebhook } from "./controllers/paymentController.js";

const app = express();

// CORS Configuration
const allowedOrigins = [
  "http://localhost:3000",
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((url) => url.trim())
    : []),
];

app.use(
  cors({
    origin: allowedOrigins,
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
app.use("/api/users", userRoutes);

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  console.error(`[FixMate Fault] ${err.message}`, !isProduction ? err.stack : "");

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Technical Workshop Error",
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

export default app;