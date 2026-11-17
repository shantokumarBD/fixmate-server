import "dotenv/config";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";

const PORT = process.env.PORT || 5000;


// Start server after database connection
async function startServer() {
  
  await connectDB();

  app.listen(PORT, () => {
    console.log(`FixMate server running on http://localhost:${PORT}`);
  });
}

startServer();