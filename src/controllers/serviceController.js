import { services } from "../config/db.js";
import { ObjectId } from "mongodb";

export const getAllServices = async (req, res) => {
  try {
    const query = {
      approvalStatus: "approved",
      isAvailable: true,
    };

    const result = await services.find().toArray();
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
