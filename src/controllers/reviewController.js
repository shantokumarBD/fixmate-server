import { bookings, services, users } from "../config/db.js";
import { ObjectId } from "mongodb";

const toObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : id);

// POST /api/reviews - Customer: Submit a verified review for a completed & paid booking
export const submitReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || rating === undefined || !comment) {
      return res.status(400).json({ message: "Booking ID, rating, and comment are required" });
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
    }

    const cleanComment = String(comment).trim();
    if (cleanComment.length < 5) {
      return res.status(400).json({ message: "Review comment must be at least 5 characters long" });
    }

    const queryBookingId = toObjectId(bookingId);
    const booking = await bookings.findOne({ _id: queryBookingId });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // 1. Ownership check: only the booking owner customer can review
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ message: "You are not authorized to review this booking" });
    }

    // 2. State Machine requirement: must be completed AND paid
    if (booking.status !== "completed") {
      return res.status(400).json({
        message: "You can only review a service after the repair has been marked as completed",
      });
    }

    if (booking.paymentStatus !== "paid") {
      return res.status(400).json({
        message: "You can only review a service after payment has been verified",
      });
    }

    // 3. Duplicate protection: one review per booking
    if (booking.isReviewed) {
      return res.status(400).json({ message: "You have already reviewed this booking" });
    }

    const serviceId = toObjectId(booking.serviceId);
    const service = await services.findOne({ _id: serviceId });
    if (!service) {
      return res.status(404).json({ message: "Associated service not found" });
    }

    // Optional reviewer image lookup
    const customer = await users.findOne({ email: req.user.email });

    const reviewDoc = {
      reviewId: new ObjectId().toString(),
      bookingId: booking._id.toString(),
      customerName: req.user.name || booking.customerName || "Customer",
      customerEmail: req.user.email,
      customerImage: customer?.image || req.user.image || "",
      rating: numRating,
      comment: cleanComment,
      createdAt: new Date(),
    };

    // 4. Mark booking as reviewed atomically
    const bookingUpdate = await bookings.updateOne(
      { _id: queryBookingId, isReviewed: { $ne: true } },
      {
        $set: {
          isReviewed: true,
          review: {
            rating: numRating,
            comment: cleanComment,
            reviewedAt: reviewDoc.createdAt,
          },
        },
      }
    );

    if (bookingUpdate.matchedCount === 0) {
      return res.status(409).json({ message: "Conflict: Review already recorded for this booking" });
    }

    // 5. Append review to service document & recompute averageRating + reviewCount
    const existingReviews = Array.isArray(service.reviews) ? service.reviews : [];
    const updatedReviews = [reviewDoc, ...existingReviews];
    const totalRatings = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = Math.round((totalRatings / updatedReviews.length) * 10) / 10;
    const reviewCount = updatedReviews.length;

    await services.updateOne(
      { _id: serviceId },
      {
        $set: {
          reviews: updatedReviews,
          averageRating,
          reviewCount,
          updatedAt: new Date(),
        },
      }
    );

    res.status(201).json({
      success: true,
      message: "Review submitted successfully! Thank you for your feedback.",
      review: reviewDoc,
      serviceRating: {
        averageRating,
        reviewCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/reviews/service/:serviceId - Public: Get all reviews for a service
export const getServiceReviews = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const queryId = toObjectId(serviceId);

    const service = await services.findOne(
      { _id: queryId },
      { projection: { reviews: 1, averageRating: 1, reviewCount: 1, title: 1 } }
    );

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    const reviews = (service.reviews || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      serviceId: service._id,
      averageRating: service.averageRating || 0,
      reviewCount: service.reviewCount || reviews.length,
      reviews,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
