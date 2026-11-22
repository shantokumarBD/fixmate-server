import { bookings, payments } from "../config/db.js";
import { stripe } from "../config/stripe.js";
import { ObjectId } from "mongodb";

// Shared Reusable Helper: Records payment and updates booking idempotently
export const recordSuccessfulPayment = async (session) => {
  const sessionId = session.id;
  const bookingId = session.metadata?.bookingId;
  const queryBookingId = ObjectId.isValid(bookingId) ? new ObjectId(bookingId) : bookingId;
  const transactionId = session.payment_intent || session.id;

  // 1. Idempotency Check: if payment already recorded, return existing
  const existingPayment = await payments.findOne({ stripeSessionId: sessionId });
  if (existingPayment) {
    return existingPayment;
  }

  // 2. Fetch booking details for full record audit
  const booking = await bookings.findOne({ _id: queryBookingId });

  // 3. Update booking status to paid (Atomic condition: only where paymentStatus is strictly 'unpaid')
  await bookings.updateOne(
    { _id: queryBookingId, paymentStatus: "unpaid" },
    {
      $set: {
        paymentStatus: "paid",
        transactionId,
        paidAt: new Date(),
      },
    }
  );

  // 4. PDF Specification Payment Record (PDF Page 5)
  const meta = session.metadata || {};
  const paymentRecord = {
    bookingId: queryBookingId ? queryBookingId.toString() : "",
    serviceTitle: booking?.serviceTitle || meta.serviceTitle || "Repair Service",
    customerName: booking?.customerName || meta.customerName || "Customer",
    customerEmail: meta.customerEmail || session.customer_email || booking?.customerEmail || "",
    technicianName: booking?.technicianName || meta.technicianName || "Technician",
    technicianEmail: booking?.technicianEmail || meta.technicianEmail || "",
    amount: (session.amount_total || 0) / 100, // convert cents to USD
    currency: session.currency || "usd",
    transactionId,
    stripeSessionId: sessionId,
    paymentStatus: "paid",
    paidAt: new Date(),
  };

  try {
    await payments.insertOne(paymentRecord);
  } catch (insertErr) {
    if (insertErr.code !== 11000) throw insertErr;
  }

  return paymentRecord;
};

// POST /api/payments/create-checkout-session - Customer: Create Stripe Checkout Session
export const createCheckoutSession = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ message: "Booking ID is required" });
    }

    const queryId = ObjectId.isValid(bookingId) ? new ObjectId(bookingId) : bookingId;
    const booking = await bookings.findOne({ _id: queryId });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Ownership check: only the customer who booked can pay
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ message: "You are not authorized to pay for this booking" });
    }

    // Pay-After-Service: must be completed
    if (booking.status !== "completed") {
      return res.status(400).json({
        message: "Payment is only enabled after the service has been marked as completed",
      });
    }

    // Check if already paid
    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "This booking is already paid" });
    }

    // Valid final amount check
    if (!booking.finalAmount || Number(booking.finalAmount) <= 0) {
      return res.status(400).json({ message: "Valid final amount is not set for this service" });
    }

    const clientUrl =
      (process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",")[0].trim() : "") ||
      "http://localhost:3000";

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
            unit_amount: Math.round(Number(booking.finalAmount) * 100),
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

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error) {
    res.status(500).json({ message: "Failed to create checkout session", error: error.message });
  }
};

// GET or POST /api/payments/verify - Verify Stripe payment & update booking
export const verifyPayment = async (req, res) => {
  try {
    const sessionId = req.query.session_id || req.body.sessionId;
    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    // 1. Retrieve session directly from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid = session.status === "complete" || session.payment_status === "paid";

    if (!isPaid) {
      return res.status(400).json({ message: "Payment has not been completed on Stripe" });
    }

    // 2. Ownership verification: session.metadata.customerEmail === req.user.email
    const metadataEmail = session.metadata?.customerEmail;
    if (!metadataEmail || !req.user?.email || metadataEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({
        message: "Forbidden: Stripe session does not belong to your account",
      });
    }

    // 3. Process payment record using shared idempotent helper
    const paymentRecord = await recordSuccessfulPayment(session);

    res.json({
      success: true,
      message: "Payment verified successfully",
      payment: paymentRecord,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify payment", error: error.message });
  }
};

// GET /api/payments/my - Customer: Get own payment history
export const getMyPayments = async (req, res) => {
  try {
    const history = await payments
      .find({ customerEmail: req.user.email })
      .sort({ paidAt: -1 })
      .toArray();

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch payment history", error: error.message });
  }
};


// POST /api/payments/webhook - Stripe webhook listener
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // Fail-fast if webhook secret is missing from environment
  if (!secret) {
    console.error("[CRITICAL SECURITY ERROR] STRIPE_WEBHOOK_SECRET is missing from environment variables.");
    return res.status(500).json({ error: "Server misconfiguration: STRIPE_WEBHOOK_SECRET is missing" });
  }

  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed ONLY when payment_status is strictly 'paid'
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      try {
        await recordSuccessfulPayment(session);
      } catch (err) {
        return res.status(500).json({ error: "Failed to process payment in webhook" });
      }
    }
  }

  res.json({ received: true });
};
