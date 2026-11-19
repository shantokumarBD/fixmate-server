import express from "express";
import cors from "cors";

import serviceRoutes from "./routes/serviceRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();


// Middlewares
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);


// JSON Body Parser
app.use(express.json());




// Root Route
app.get("/", (req, res) => {
  res.send("FixMate server is running smoothly!....");
});


app.use("/api/services", serviceRoutes);

app.use("/api/bookings", bookingRoutes);

app.use("/api/payments", paymentRoutes);

export default app;