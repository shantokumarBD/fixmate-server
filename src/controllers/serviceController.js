import { services, users } from "../config/db.js";
import { ObjectId } from "mongodb";

// Helper: safe search regex escape
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

// GET /api/services - Public: List all approved services with filters & limit
export const getAllServices = async (req, res) => {
  try {
    const { category, serviceMode, search, sort, limit } = req.query;

    const query = {
      approvalStatus: "approved",
      isAvailable: true,
    };

    if (category) query.category = String(category);
    if (serviceMode) query.serviceMode = String(serviceMode);

    if (search && String(search).trim() !== "") {
      const safeSearch = escapeRegex(search.trim());
      query.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { category: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const sortMap = {
      price_asc: { basePrice: 1 },
      asc: { basePrice: 1 },
      price_desc: { basePrice: -1 },
      desc: { basePrice: -1 },
      newest: { createdAt: -1 },
    };
    const sortOption = sortMap[sort] || { createdAt: -1 };

    let cursor = services.find(query).sort(sortOption);

    if (limit && !isNaN(Number(limit)) && Number(limit) > 0) {
      cursor = cursor.limit(Number(limit));
    }

    const result = await cursor.toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/services/:id - Public: Get single service details with technician summary
export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const queryId = toObjectId(id);

    const service = await services.findOne({
      _id: queryId,
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({ message: "Service not found or currently unavailable" });
    }

    // Lookup technician profile from 'users' collection (Item 12 / PDF Page 3)
    const technician = await users.findOne(
      { email: service.technicianEmail },
      { projection: { name: 1, image: 1, area: 1, bio: 1, phone: 1 } }
    );

    res.json({
      ...service,
      technician: {
        name: technician?.name || service.technicianName,
        image: technician?.image || "",
        area: technician?.area || service.serviceArea || "",
        bio: technician?.bio || "",
        phone: technician?.phone || "",
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/services - Technician: Create a new repair service
export const createService = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    if (!title || !category || !basePrice) {
      return res.status(400).json({ message: "Title, category, and basePrice are required" });
    }

    const selectedMode = serviceMode || "Home Visit";
    if (!["Home Visit", "Shop Drop-off"].includes(selectedMode)) {
      return res.status(400).json({
        message: "serviceMode must be either 'Home Visit' or 'Shop Drop-off'",
      });
    }

    const newService = {
      title: String(title).trim(),
      category: String(category).trim(),
      description: description ? String(description).trim() : "",
      image: image || "",
      basePrice: Number(basePrice),
      estimatedDuration: estimatedDuration || "",
      serviceMode: selectedMode,
      serviceArea: serviceArea || "",
      technicianName: req.user.name,
      technicianEmail: req.user.email,
      approvalStatus: "pending",
      isAvailable: true,
      createdAt: new Date(),
    };

    const result = await services.insertOne(newService);
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Failed to create service", error: error.message });
  }
};

// GET /api/services/my - Technician: Get all services created by logged-in technician
export const getMyServices = async (req, res) => {
  try {
    const result = await services
      .find({ technicianEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch technician services", error: error.message });
  }
};

// PATCH /api/services/:id - Technician: Update own service
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, description, image, basePrice, estimatedDuration, serviceMode, serviceArea } = req.body;

    if (serviceMode && !["Home Visit", "Shop Drop-off"].includes(serviceMode)) {
      return res.status(400).json({
        message: "serviceMode must be either 'Home Visit' or 'Shop Drop-off'",
      });
    }

    const queryId = toObjectId(id);
    const updateFields = {
      ...(title && { title: String(title).trim() }),
      ...(category && { category: String(category).trim() }),
      ...(description !== undefined && { description: String(description).trim() }),
      ...(image && { image }),
      ...(basePrice !== undefined && { basePrice: Number(basePrice) }),
      ...(estimatedDuration && { estimatedDuration }),
      ...(serviceMode && { serviceMode }),
      ...(serviceArea && { serviceArea }),
      approvalStatus: "pending", // edits require re-approval
      updatedAt: new Date(),
    };

    const result = await services.updateOne(
      { _id: queryId, technicianEmail: req.user.email },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Service not found or you are not authorized to edit this",
      });
    }

    res.json({ success: true, message: "Service updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/services/:id - Technician: Delete own service
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const queryId = toObjectId(id);

    const result = await services.deleteOne({
      _id: queryId,
      technicianEmail: req.user.email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "Service not found or you are not authorized to delete this",
      });
    }

    res.json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete service", error: error.message });
  }
};

// PATCH /api/services/:id/availability - Technician: Toggle availability without resetting approval
export const toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== "boolean") {
      return res.status(400).json({
        message: "isAvailable must be a boolean (true or false)",
      });
    }

    const queryId = toObjectId(id);

    // Updates ONLY isAvailable — approvalStatus is NEVER reset to pending
    const result = await services.updateOne(
      { _id: queryId, technicianEmail: req.user.email },
      { $set: { isAvailable, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Service not found or you are not authorized to update this service",
      });
    }

    res.json({
      success: true,
      message: `Service availability set to ${isAvailable ? "available" : "unavailable"}`,
      isAvailable,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
