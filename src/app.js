import express from "express";
import cors from "cors";

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

export default app;