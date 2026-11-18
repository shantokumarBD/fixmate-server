import { services } from "../config/db.js";
import { ObjectId } from "mongodb";

export const getAllServices = async (req, res) => {
  try {
    // 1. read query parameters from URL
    const { category, serviceMode, search } = req.query;

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

    //  pass query into find()
    const result = await services.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

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
