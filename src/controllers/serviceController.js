import { services } from "../config/db.js";
import { ObjectId } from "mongodb";

// GET /api/services - All users: List all approved services with filters
export const getAllServices = async (req, res) => {
  try {
    // 1. read query parameters from URL
    const { category, serviceMode, search, sort } = req.query;

    const query = {
      approvalStatus: "approved",
      isAvailable: true,
    };

    // Filter by category (e.g. ?category=AC)
    if (category) {
      query.category = category;
    }

    // Filter by service mode (e.g. ?serviceMode=Home Visit)
    if (serviceMode) {
      query.serviceMode = serviceMode;
    }

    // Search by title or category
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // 2. Sorting logic (Default: newest first)
    let sortOption = { createdAt: -1 };

    if (sort === "price_asc") {
      sortOption = { basePrice: 1 }; // Lowest price first
    } else if (sort === "price_desc") {
      sortOption = { basePrice: -1 }; // Highest price first
    } else if (sort === "newest") {
      sortOption = { createdAt: -1 }; // Newest first
    }

    //  pass query into find()
    const result = await services.find(query).sort(sortOption).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// GET /api/services/:id - Customer/Technician/Admin: Get service by ID

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) }
      : { _id: id };

    const result = await services.findOne(query);

    if (!result) {
      return res.status(404).send({ message: "Service not found" });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
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

    // Basic validation: check required fields
    if (!title || !category || !basePrice) {
      return res
        .status(400)
        .json({ message: "Title, category, and basePrice are required" });
    }

    // Prepare new service document with server-controlled defaults
    const newService = {
      title,
      category,
      description: description || "",
      image: image || "",
      basePrice: Number(basePrice),
      estimatedDuration: estimatedDuration || "",
      serviceMode: serviceMode || "Home Visit",
      serviceArea: serviceArea || "",
      technicianName: req.user.name,
      technicianEmail: req.user.email,
      approvalStatus: "pending", // must be approved by admin later
      isAvailable: true,
      createdAt: new Date(),
    };

    // Insert into database
    const result = await services.insertOne(newService);

    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create service", error: error.message });
  }
};

// GET /api/services/my - Technician: Get all services created by logged-in technician
export const getMyServices = async (req, res) => {
  try {
    // Only fetch services owned by this logged-in technician

    const result = await services
      .find({ technicianEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch technician services",
      error: error.message,
    });
  }
};

// PATCH /api/services/:id - Technician: Update own service

export const updateService = async (req, res) => {
  try {
    const { id } = req.params;

    const queryId = ObjectId.isValid(id) ? new ObjectId(id) : id;

    const updateData = {
      ...req.body,
      approvalStatus: "pending",
      updatedAt: new Date(),
    };

    // Prevent modifying immutable fields or changing owner (Ekhane boshbe)
    delete updateData._id;
    delete updateData.technicianEmail;

    const result = await services.updateOne(
      { _id: queryId, technicianEmail: req.user.email },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Service not found or you are not authorized to edit this",
      });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// DELETE /api/services/:id - Technician: Delete own service
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const queryId = ObjectId.isValid(id) ? new ObjectId(id) : id;

    // Delete only if both _id and technicianEmail match (Ownership verification)
    const result = await services.deleteOne({
      _id: queryId,
      technicianEmail: req.user.email,
    });

    // If deletedCount is 0, service does not exist OR technician is not the owner
    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "Service not found or you are not authorized to delete this",
      });
    }

    res.json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete service", error: error.message });
  }
};
