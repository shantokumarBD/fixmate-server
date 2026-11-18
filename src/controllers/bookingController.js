import { bookings, services } from "../config/db.js";
import { ObjectId } from "mongodb";

// POST /api/bookings - Customer: Create a new service booking

export const createBooking = async (req, res) => {
  try {
    const { serviceId, bookingDate, timeSlot, customerAddress, customerPhone } =
      req.body;

    // 1. Check required fields
    if (
      !serviceId ||
      !bookingDate ||
      !timeSlot ||
      !customerAddress ||
      !customerPhone
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    // Fetch service from database
    const queryId = ObjectId.isValid(serviceId)
      ? new ObjectId(serviceId)
      : serviceId;

    const service = await services.findOne({ _id: queryId });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    // Duplicate check: prevent booking same service on same date

    const existingBooking = await bookings.findOne({
      serviceId: service._id,
      customerEmail: req.user.email,
      bookingDate: bookingDate,
      status: { $in: ["requested", "accepted"] },
    });
    if (existingBooking) {
      return res.status(400).json({
        message:
          "You already have an active booking for this service on this date",
      });
    }

    // Create booking document and save to database

    const newBooking = {
      ...req.body,
      serviceId: service._id,
      serviceTitle: service.title,
      serviceImage: service.image || "",
      category: service.category,
      technicianEmail: service.technicianEmail,
      technicianName: service.technicianName,
      customerName: req.user.name,
      customerEmail: req.user.email,
      status: "requested",
      paymentStatus: "unpaid",
      basePrice: service.basePrice,
      finalAmount: service.basePrice,
      createdAt: new Date(),
    };

    delete newBooking._id;

    const result = await bookings.insertOne(newBooking);

    res.status(201).json({
      success: true,
      message: "Booking requested successfully",
      bookingId: result.insertedId,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create booking", error: error.message });
  }
};

// GET /api/bookings/my - Customer: Get all bookings created by logged-in customer
export const getMyBookings = async (req, res) => {
  try {
    const result = await bookings
      .find({ customerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch bookings", error: error.message });
  }
};

// PATCH /api/bookings/:id/cancel - Customer: Cancel own booking
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const queryId = ObjectId.isValid(id) ? new ObjectId(id) : id;

    // Find booking and verify customer ownership
    const booking = await bookings.findOne({
      _id: queryId,
      customerEmail: req.user.email,
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found or you do not have permission to cancel it",
      });
    }

    // Cancellation rule: only allowed if status is 'requested' or 'accepted'
    if (booking.status !== "requested" && booking.status !== "accepted") {
      return res.status(400).json({
        message: `Cannot cancel a booking that is already ${booking.status}`,
      });
    }

    // Update status to 'cancelled'
    await bookings.updateOne(
      { _id: queryId },
      { $set: { status: "cancelled", updatedAt: new Date() } },
    );

    res.json({ success: true, message: "Booking cancelled successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to cancel booking", error: error.message });
  }
};
