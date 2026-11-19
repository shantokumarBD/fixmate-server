import { users } from "../config/db.js";

// GET /api/users/me - Authenticated: Get logged-in user profile
export const getMyProfile = async (req, res) => {
  try {
    const user = await users.findOne(
      { email: req.user.email },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/users/profile - Authenticated: Update own profile
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, area, bio, image } = req.body;

    // Strict Whitelist: email and role must NEVER be updated here (Item 8)
    const updateFields = {};

    if (name !== undefined) updateFields.name = String(name).trim();
    if (phone !== undefined) updateFields.phone = String(phone).trim();
    if (area !== undefined) updateFields.area = String(area).trim();
    if (bio !== undefined) updateFields.bio = String(bio).trim();
    if (image !== undefined) updateFields.image = String(image).trim();

    updateFields.updatedAt = new Date();

    const result = await users.updateOne(
      { email: req.user.email },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return the updated profile
    const updatedUser = await users.findOne(
      { email: req.user.email },
      { projection: { password: 0 } }
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};