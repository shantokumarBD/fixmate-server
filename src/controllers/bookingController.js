import { bookings, services } from "../config/db.js";
import { isValidTransition } from "../utils/statusPipeline.js";
import { ObjectId } from "mongodb";

// POST /api/bookings - Customer: Create a new service booking
export const createBooking = async (req, res) => {
  try {
    const {
      serviceId,
      preferredDate,
      address,
      customerPhone,
      phone,
      problemDescription,
      timeSlot,
    } = req.body;

    const contactPhone = customerPhone || phone;

    // 1. Validate required fields
    if (!serviceId || !preferredDate || !address || !contactPhone || !problemDescription) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Problem description minimum 20 characters rule (PDF Page 10)
    if (problemDescription.trim().length < 20) {
      return res.status(400).json({ message: "Problem description must be at least 20 characters long" });
    }

    // Preferred date must be today or in the future (timezone-safe)
    const inputDate = new Date(preferredDate);
    if (isNaN(inputDate.getTime())) {
      return res.status(400).json({ message: "Invalid preferred date" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timezoneBuffer = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    if (inputDate < timezoneBuffer) {
      return res.status(400).json({ message: "Preferred date must be today or a future date" });
    }

    // 2. Fetch service
    const queryId = ObjectId.isValid(serviceId) ? new ObjectId(serviceId) : serviceId;
    const service = await services.findOne({ _id: queryId });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    // 3. Duplicate check: prevent duplicate active booking for the same service
    const existingBooking = await bookings.findOne({
      serviceId: { $in: [service._id, service._id.toString()] },
      customerEmail: req.user.email,
      status: { $in: ["requested", "accepted", "in-progress"] },
    });

    if (existingBooking) {
      return res.status(400).json({ message: "You already have an active booking request for this service" });
    }

    // 4. Create booking document with copied snapshot fields (PDF Page 4 & 5)
    const newBooking = {
      serviceId: service._id,
      serviceTitle: service.title,
      serviceImage: service.image || "",
      category: service.category,
      basePrice: service.basePrice,
      finalAmount: service.basePrice,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerPhone: contactPhone,
      address,
      preferredDate: inputDate,
      timeSlot: timeSlot || "",
      problemDescription: problemDescription.trim(),
      status: "requested",
      paymentStatus: "unpaid",
      createdAt: new Date(),
    };

    const result = await bookings.insertOne(newBooking);
    res.status(201).json({ success: true, message: "Booking requested successfully", bookingId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/bookings/my - Customer: Get all bookings created by logged-in customer
export const getMyBookings = async (req, res) => {
  try {
    const result = await bookings.find({ customerEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/bookings/:id/cancel - Customer: Cancel own booking (Only while 'requested')
export const cancelBooking = async (req, res) => {
  try {
    const queryId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;

    const booking = await bookings.findOne({ _id: queryId, customerEmail: req.user.email });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found or you do not have permission to cancel it" });
    }

    if (booking.status !== "requested") {
      return res.status(400).json({
        message: `Cannot cancel a booking once it is ${booking.status}. Cancellation is only allowed for 'requested' bookings.`,
      });
    }

    await bookings.updateOne(
      { _id: queryId, status: "requested" },
      { $set: { status: "cancelled", updatedAt: new Date() } }
    );

    res.json({ success: true, message: "Booking cancelled successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/bookings/technician - Technician: Get all bookings assigned to logged-in technician
export const getTechnicianBookings = async (req, res) => {
  try {
    const result = await bookings.find({ technicianEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/bookings/:id/status - Technician: Update booking status via Challenge 3 pipeline
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, finalAmount } = req.body;
    const queryId = ObjectId.isValid(id) ? new ObjectId(id) : id;

    // 1. Verify booking exists and belongs to this technician
    const booking = await bookings.findOne({ _id: queryId, technicianEmail: req.user.email });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found or you are not authorized to update this booking" });
    }

    // 2. State Machine transition validation (Challenge 3)
    if (!isValidTransition(booking.status, status)) {
      return res.status(400).json({ message: `Invalid status transition from '${booking.status}' to '${status}'` });
    }

    const updateFields = { status, updatedAt: new Date() };

    // 3. Technician must provide finalAmount > 0 when completing
    if (status === "completed") {
      if (!finalAmount || Number(finalAmount) <= 0) {
        return res.status(400).json({
          message: "Technicians cannot mark a booking completed without entering a finalAmount > 0",
        });
      }
      updateFields.finalAmount = Number(finalAmount);
      updateFields.completedAt = new Date();
    }

    // 4. Atomic update to prevent concurrent modification race
    const result = await bookings.updateOne(
      { _id: queryId, status: booking.status },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(409).json({ message: "Conflict: Booking was modified by another request. Please refresh and try again." });
    }

    res.json({ success: true, message: `Booking status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/bookings/:id - Customer/Technician/Admin: Get single booking details
export const getBookingById = async (req, res) => {
  try {
    const queryId = ObjectId.isValid(req.params.id) ? new ObjectId(req.params.id) : req.params.id;
    const booking = await bookings.findOne({ _id: queryId });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const isCustomer = booking.customerEmail === req.user.email;
    const isTechnician = booking.technicianEmail === req.user.email;
    const isAdmin = req.user.role === "admin";

    if (!isCustomer && !isTechnician && !isAdmin) {
      return res.status(403).json({ message: "You do not have permission to view this booking" });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
