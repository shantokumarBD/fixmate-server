import "dotenv/config";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";

// Fail fast at startup if critical JWT_SECRET is missing (Item 2)
if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is missing in .env. Server shutting down.");
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

// Start server after database connection
async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`FixMate server running on http://localhost:${PORT}`);
  });

  // Keep Render awake 24/7 in production only (Self-Ping every 10 minutes)
  if (process.env.NODE_ENV === "production") {
    const LIVE_URL =
      process.env.RENDER_EXTERNAL_URL ||
      process.env.SERVER_URL ||
      "https://fixmate-server-dk6f.onrender.com";

    setInterval(() => {
      fetch(LIVE_URL)
        .then(() => console.log("[Keep-Alive] Self-ping successful"))
        .catch((err) => console.log("[Keep-Alive Ping]:", err.message));
    }, 10 * 60 * 1000);
  }
}

startServer();