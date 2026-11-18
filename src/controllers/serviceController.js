import { services } from "../config/db.js";

export const getAllServices = async (req, res) => {
  try {
    const result = await services.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};
