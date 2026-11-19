import { users, services, bookings, payments } from "../config/db.js";
import { ObjectId } from "mongodb";

// GET /api/admin/users - Admin: Get all registered users
export const getAllUsers = async (req, res) => {
  try {
    // Exclude sensitive fields if any, sort newest first
    const allUsers = await users
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(allUsers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
};

// PATCH /api/admin/users/:id/role - Admin: Change a user's role
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Allowed roles in FixMate
    const validRoles = ["customer", "technician", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    const queryId = ObjectId.isValid(id) ? new ObjectId(id) : id;
    const targetUser = await users.findOne({ _id: queryId });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Safety guard: Admin cannot change their own role to prevent accidental lockout
    if (targetUser.email === req.user.email) {
      return res.status(400).json({ message: "You cannot change your own role" });
    }

    await users.updateOne(
      { _id: queryId },
      { $set: { role, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `User role updated to ${role} successfully`,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user role", error: error.message });
  }
};