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


// GET /api/admin/services - Admin: Get all services with approval status
export const getAllServicesForAdmin = async (req, res) => {
  try {
    const allServices = await services
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(allServices);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch services", error: error.message });
  }
};

// PATCH /api/admin/services/:id/approval - Admin: Approve or reject a service
export const updateServiceApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus } = req.body;
    // Allowed approval statuses
    if (approvalStatus !== "approved" && approvalStatus !== "rejected") {
      return res.status(400).json({
        message: "Status must be either 'approved' or 'rejected'",
      });
    }
    const queryId = ObjectId.isValid(id) ? new ObjectId(id) : id;
    const result = await services.updateOne(
      { _id: queryId },
      {
        $set: {
          approvalStatus,
          updatedAt: new Date(),
        },
      }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json({
      success: true,
      message: `Service has been ${approvalStatus} successfully`,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update service approval", error: error.message });
  }
};


// GET /api/admin/bookings - Admin: Get all platform bookings
export const getAllBookingsForAdmin = async (req, res) => {
  try {
    const allBookings = await bookings
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(allBookings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bookings", error: error.message });
  }
};


// GET /api/admin/payments - Admin: Get all transaction history with total revenue
export const getAllPaymentsForAdmin = async (req, res) => {
  try {
    const allPayments = await payments
      .find({})
      .sort({ paidAt: -1 })
      .toArray();

    const totalRevenue = allPayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    res.json({
      payments: allPayments,
      totalRevenue,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch payments", error: error.message });
  }
};

// GET /api/admin/stats - Admin: Platform analytics and dashboard statistics
export const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalTechnicians,
      totalServices,
      pendingServices,
      totalBookings,
      allPayments,
    ] = await Promise.all([
      users.countDocuments(),
      users.countDocuments({ role: "technician" }),
      services.countDocuments(),
      services.countDocuments({ approvalStatus: "pending" }),
      bookings.countDocuments(),
      payments.find({}).toArray(),
    ]);

    const totalRevenue = allPayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    res.json({
      totalUsers,
      totalTechnicians,
      totalServices,
      pendingServices,
      totalBookings,
      totalRevenue,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch admin stats", error: error.message });
  }
};


