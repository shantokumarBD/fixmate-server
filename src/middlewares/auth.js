import jwt from "jsonwebtoken";
import { users } from "../config/db.js";

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  // Check if token is provided
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Token missing" });
  }

  try {
    // Find session in BetterAuth session collection
    const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET;

    const decoded = jwt.verify(token, secret);

    // Fetch current user from database by email (so admin role changes apply immediately)
    const user = await users.findOne({ email: decoded.email });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }


    // Attach user object to request and continue
    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Verification failed" });
  }
};
