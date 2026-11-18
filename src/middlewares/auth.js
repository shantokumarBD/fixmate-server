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

// Middleware: Only allow users with role 'customer'
export const verifyCustomer = (req, res, next) => {
  if (req.user?.role !== "customer") {
    return res.status(403).json({ message: "Forbidden: Customer access only" });
  }
  next();
};

// Middleware: Only allow users with role 'technician'
export const verifyTechnician = (req, res, next) => {
  if (req.user?.role !== "technician") {
    return res.status(403).json({ message: "Forbidden: Technician access only" });
  }
  next();
};

// Middleware: Only allow users with role 'admin'
export const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin access only" });
  }
  next();
};