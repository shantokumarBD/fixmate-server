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
        message: "Payment is only enabled after the service has been marked as completed",
      });
    }

    // Check if already paid
    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "This booking is already paid" });
    }

    
    // Final amount check
    if (!booking.finalAmount || Number(booking.finalAmount) <= 0) {
      return res.status(400).json({ message: "Valid final amount is not set for this service" });
    }

    // Create Stripe Checkout Session (Amount strictly from DB: booking.finalAmount)
     const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "bdt", // or "usd"
            product_data: {
              name: booking.serviceTitle,
              description: `Repair service bill for ${booking.customerName}`,
            },
            unit_amount: Math.round(Number(booking.finalAmount) * 100), // Stripe takes amount in smallest unit (cents/paisa)
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: req.user.email,
      success_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/checkout/success?session_id={CHECKOUT_SESSION_ID}&bookingId=${booking._id}`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/dashboard/customer/bookings?payment=cancelled`,
      metadata: {
        bookingId: booking._id.toString(),
        customerEmail: req.user.email,
        technicianEmail: booking.technicianEmail,
      },
    });


    res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });





  } catch (error) {
    res.status(500).json({ message: "Failed to create checkout session", error: error.message });
  }
};



// POST /api/payments/verify - Customer/System: Verify Stripe payment & update booking
export const verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    // 1. Retrieve session details directly from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment has not been completed" });
    }

    const bookingId = session.metadata.bookingId;
    const queryBookingId = ObjectId.isValid(bookingId) ? new ObjectId(bookingId) : bookingId;
    const transactionId = session.payment_intent || session.id;

    // 2. Prevent duplicate entries (Idempotency check)
    const existingPayment = await payments.findOne({ transactionId });
    if (existingPayment) {
      return res.json({
        success: true,
        message: "Payment already verified",
        payment: existingPayment,
      });
    }

    // 3. Update booking status to paid
    await bookings.updateOne(
      { _id: queryBookingId },
      {
        $set: {
          paymentStatus: "paid",
          transactionId: transactionId,
          paidAt: new Date(),
        },
      }
    );

    // 4. Log transaction in payments collection (Challenge 4 Requirement)
    const paymentRecord = {
      bookingId: queryBookingId,
      customerEmail: session.customer_email || session.metadata.customerEmail,
      technicianEmail: session.metadata.technicianEmail,
      amount: (session.amount_total || 0) / 100, // convert back from paisa to regular currency
      transactionId: transactionId,
      paymentMethod: "stripe",
      createdAt: new Date(),
    };

    await payments.insertOne(paymentRecord);

    res.json({
      success: true,
      message: "Payment verified successfully",
      payment: paymentRecord,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify payment", error: error.message });
  }
};