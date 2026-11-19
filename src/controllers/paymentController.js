import { bookings, payments } from "../config/db.js";
import { stripe } from "../config/stripe.js";
import { ObjectId } from "mongodb";

// POST /api/payments/create-checkout-session - Customer: Create Stripe Checkout Session
export const createCheckoutSession = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ message: "Booking ID is required" });
    }

    const queryId = ObjectId.isValid(bookingId)
      ? new ObjectId(bookingId)
      : bookingId;

    // Fetch booking from database
    const booking = await bookings.findOne({ _id: queryId });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Ownership check: only the customer who booked can pay
    if (booking.customerEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "You are not authorized to pay for this booking" });
    }

    // Challenge 4 Rule: Pay-After-Service (Must be completed)
    if (booking.status !== "completed") {
      return res.status(400).json({
        message:
          "Payment is only enabled after the service has been marked as completed",
      });
    }

    // Check if already paid
    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "This booking is already paid" });
    }

    // Final amount check
    if (!booking.finalAmount || Number(booking.finalAmount) <= 0) {
      return res
        .status(400)
        .json({ message: "Valid final amount is not set for this service" });
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

    // Create Stripe Checkout Session in USD
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: booking.serviceTitle,
              description: `Repair service payment for ${booking.customerName}`,
            },
            unit_amount: Math.round(Number(booking.finalAmount) * 100), // convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: req.user.email,
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel`,
      metadata: {
        bookingId: booking._id.toString(),
        serviceTitle: booking.serviceTitle,
        customerName: booking.customerName,
        customerEmail: req.user.email,
        technicianName: booking.technicianName,
        technicianEmail: booking.technicianEmail,
      },
    });

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

// GET or POST /api/payments/verify - Verify Stripe payment & update booking
export const verifyPayment = async (req, res) => {
  try {
    // Support session_id from URL query (GET) or body (POST)
    const sessionId = req.query.session_id || req.body.sessionId;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    // 1. Retrieve session details directly from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const isPaid =
      session.status === "complete" || session.payment_status === "paid";
    if (!isPaid) {
      return res
        .status(400)
        .json({ message: "Payment has not been completed on Stripe" });
    }

    // 2. Ownership Verification: Check if session belongs to logged-in user
    const sessionCustomerEmail =
      session.metadata?.customerEmail ||
      session.customer_email ||
      session.customer_details?.email;

    if (
      sessionCustomerEmail &&
      req.user?.email &&
      sessionCustomerEmail.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      return res.status(403).json({
        message: "Forbidden: Stripe session does not belong to your account",
      });
    }

    // 3. Idempotency Check: if payment already recorded, exit early
    const existingPayment = await payments.findOne({ stripeSessionId: sessionId });
    if (existingPayment) {
      return res.json({
        success: true,
        message: "Payment already verified",
        payment: existingPayment,
      });
    }

    const bookingId = session.metadata?.bookingId;
    const queryBookingId = ObjectId.isValid(bookingId)
      ? new ObjectId(bookingId)
      : bookingId;
    const transactionId = session.payment_intent || session.id;

    // Fetch booking details to complete payment record
    const booking = await bookings.findOne({ _id: queryBookingId });

    // 4. Update booking status to paid (Atomic condition: only if unpaid)
    await bookings.updateOne(
      { _id: queryBookingId, paymentStatus: { $ne: "paid" } },
      {
        $set: {
          paymentStatus: "paid",
          transactionId: transactionId,
          paidAt: new Date(),
        },
      }
    );

    // 5. PDF Specification Payment Record
    const paymentRecord = {
      bookingId: queryBookingId ? queryBookingId.toString() : "",
      serviceTitle:
        booking?.serviceTitle ||
        session.metadata?.serviceTitle ||
        "Repair Service",
      customerName:
        booking?.customerName ||
        session.metadata?.customerName ||
        "Customer",
      customerEmail: sessionCustomerEmail || req.user.email,
      technicianName:
        booking?.technicianName ||
        session.metadata?.technicianName ||
        "Technician",
      technicianEmail:
        booking?.technicianEmail ||
        session.metadata?.technicianEmail ||
        "",
      amount: (session.amount_total || 0) / 100, // convert back from cents to USD
      currency: session.currency || "usd",
      transactionId: transactionId,
      stripeSessionId: sessionId,
      paymentStatus: "paid",
      paidAt: new Date(),
    };

    try {
      await payments.insertOne(paymentRecord);
    } catch (insertErr) {
      // Gracefully handle duplicate key if concurrent verification occurs
      if (insertErr.code !== 11000) {
        throw insertErr;
      }
    }

    res.json({
      success: true,
      message: "Payment verified successfully",
      payment: paymentRecord,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to verify payment",
      error: error.message,
    });
  }
};