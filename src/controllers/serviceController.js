import { services, users } from "../config/db.js";
import { ObjectId } from "mongodb";

// Helper: escape special regex characters for safe search
const escapeRegex = (text) => {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// GET /api/services - Public: List all approved services with filters & limit
export const getAllServices = async (req, res) => {
  try {
    // 1. Read query parameters from URL
    const { category, serviceMode, search, sort, limit } = req.query;

    const query = {
      approvalStatus: "approved",
      isAvailable: true,
    };

    // Filter by category (e.g. ?category=Air Conditioner)
    if (category) {
      query.category = String(category);
    }

    // Filter by service mode (e.g. ?serviceMode=Home Visit)
    if (serviceMode) {
      query.serviceMode = String(serviceMode);
    }

    // Safe Search by title or category (escaped regex prevents ReDoS / crashes)
    if (search && String(search).trim() !== "") {
      const safeSearch = escapeRegex(search.trim());
      query.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { category: { $regex: safeSearch, $options: "i" } },
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

    // 3. Find with query and sort
    let cursor = services.find(query).sort(sortOption);

    // Apply limit if provided (e.g. ?limit=6 for home page featured services)
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

    const queryId = ObjectId.isValid(id)
      ? new ObjectId(id)
      : id;

    // Service must be approved and available for public viewing (Item 12)
    const service = await services.findOne({
      _id: queryId,
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found or currently unavailable",
      });
    }

    // Lookup technician profile from 'users' collection (Item 12)
    const technician = await users.findOne(
      { email: service.technicianEmail },
      {
        projection: {
          name: 1,
          image: 1,
          area: 1,
          bio: 1,
          phone: 1,
        },
      }
    );

    // Attach technician summary
    const responseData = {
      ...service,
      technician: {
        name: technician?.name || service.technicianName,
        image: technician?.image || "",
        area: technician?.area || service.serviceArea || "",
        bio: technician?.bio || "",
        phone: technician?.phone || "",
      },
    };

    res.json(responseData);
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

    // Basic validation: check required fields
    if (!title || !category || !basePrice) {
      return res
        .status(400)
        .json({ message: "Title, category, and basePrice are required" });
    }

    // Validate serviceMode (must strictly be 'Home Visit' or 'Shop Drop-off')
    const validModes = ["Home Visit", "Shop Drop-off"];
    const selectedMode = serviceMode || "Home Visit";

    if (!validModes.includes(selectedMode)) {
      return res.status(400).json({
        message: "serviceMode must be either 'Home Visit' or 'Shop Drop-off'",
      });
    }

    // Prepare new service document with server-controlled defaults
    const newService = {
      title,
      category,
      description: description || "",
      image: image || "",
      basePrice: Number(basePrice),
      estimatedDuration: estimatedDuration || "",
      serviceMode: selectedMode,
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

    // Validate serviceMode if provided in update
    if (req.body.serviceMode) {
      const validModes = ["Home Visit", "Shop Drop-off"];
      if (!validModes.includes(req.body.serviceMode)) {
        return res.status(400).json({
          message: "serviceMode must be either 'Home Visit' or 'Shop Drop-off'",
        });
      }
    }

    const queryId = ObjectId.isValid(id) ? new ObjectId(id) : id;

    const updateData = {
      ...req.body,
      approvalStatus: "pending", // edits require re-approval
      updatedAt: new Date(),
    };

    // Prevent modifying immutable fields or changing owner
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

    const queryId = ObjectId.isValid(id) ? new ObjectId(id) : id;

    // Updates ONLY isAvailable — approvalStatus is NEVER reset to pending
    const result = await services.updateOne(
      { _id: queryId, technicianEmail: req.user.email },
      { $set: { isAvailable, updatedAt: new Date() } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message:
          "Service not found or you are not authorized to update this service",
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

