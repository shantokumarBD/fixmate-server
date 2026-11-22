import "dotenv/config";
import jwt from "jsonwebtoken";

const BASE_URL = process.env.TEST_URL || "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "a-string-secret-at-least-256-bits-long";

// Generate test tokens with mandatory 'exp' claim
const customerToken = jwt.sign({ email: "shanto.customer@gmail.com" }, JWT_SECRET, { algorithm: "HS256", expiresIn: "1d" });
const techToken = jwt.sign({ email: "rahim.tech@fixmate.com" }, JWT_SECRET, { algorithm: "HS256", expiresIn: "1d" });
const otherTechToken = jwt.sign({ email: "tanvir.tech@fixmate.com" }, JWT_SECRET, { algorithm: "HS256", expiresIn: "1d" });
const adminToken = jwt.sign({ email: "admin@fixmate.com" }, JWT_SECRET, { algorithm: "HS256", expiresIn: "1d" });
const otherCustomerToken = jwt.sign({ email: "other.customer@fixmate.com" }, JWT_SECRET, { algorithm: "HS256", expiresIn: "1d" });

let passed = 0;
let failed = 0;
let skipped = 0;

async function test(title, fn) {
  try {
    const result = await fn();
    if (result === "SKIP") {
      console.log(` \x1b[33m[SKIP]\x1b[0m ${title}`);
      skipped++;
    } else {
      console.log(` \x1b[32m[PASS]\x1b[0m ${title}`);
      passed++;
    }
  } catch (err) {
    console.error(` \x1b[31m[FAIL]\x1b[0m ${title}`);
    console.error(`        Error: ${err.message}`);
    failed++;
  }
}

async function runSmokeTests() {
  console.log("\n=======================================================");
  console.log("       FixMate Backend Automated Smoke Test Suite      ");
  console.log(`       Target: ${BASE_URL}                            `);
  console.log("=======================================================\n");

  // 1. Health check
  await test("Root Health Check (GET / returns 200)", async () => {
    const res = await fetch(`${BASE_URL}/`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // 2. Public Services List & Sample ID
  let sampleService = null;
  let ownerTechToken = techToken;
  let nonOwnerTechToken = otherTechToken;

  await test("Public Services List (GET /api/services returns approved services)", async () => {
    const res = await fetch(`${BASE_URL}/api/services`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Expected array response");
    if (data.length > 0) {
      sampleService = data.find((s) => s.technicianEmail === "rahim.tech@fixmate.com") || data[0];
      if (sampleService.technicianEmail === "rahim.tech@fixmate.com") {
        ownerTechToken = techToken;
        nonOwnerTechToken = otherTechToken;
      } else {
        ownerTechToken = otherTechToken;
        nonOwnerTechToken = techToken;
      }
    }
  });

  // 3. Limit Parameter
  await test("Services Limit Param (GET /api/services?limit=2 returns <= 2 items)", async () => {
    const res = await fetch(`${BASE_URL}/api/services?limit=2`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    if (data.length > 2) throw new Error(`Expected <= 2 items, got ${data.length}`);
  });

  // 4. Safe Regex Search
  await test("Safe Search (GET /api/services?search=.* handles special regex characters)", async () => {
    const res = await fetch(`${BASE_URL}/api/services?search=.*`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // 4b. ServiceMode Filter Parameter (Item 1)
  await test("ServiceMode Filter (GET /api/services?serviceMode=Home%20Visit filters accurately)", async () => {
    const res = await fetch(`${BASE_URL}/api/services?serviceMode=Home%20Visit`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Expected array response");
    for (const item of data) {
      if (item.serviceMode !== "Home Visit") {
        throw new Error(`Expected serviceMode 'Home Visit', got '${item.serviceMode}'`);
      }
    }
  });

  // 5. Auth Guard: Missing Token
  await test("Auth Guard: Missing token returns 401 Unauthorized", async () => {
    const res = await fetch(`${BASE_URL}/api/users/me`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 6. Auth Guard: Token without exp claim (Step 4 hardening)
  await test("Auth Guard: Token missing 'exp' claim is rejected (401)", async () => {
    const unexpiredToken = jwt.sign({ email: "shanto.customer@gmail.com" }, JWT_SECRET, { algorithm: "HS256" });
    const res = await fetch(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${unexpiredToken}` },
    });
    if (res.status !== 401) throw new Error(`Expected 401 for token without exp, got ${res.status}`);
  });

  // 7. Role Guard: Customer cannot create a repair service
  await test("RBAC Guard: Customer cannot create a repair service (403 Forbidden)", async () => {
    const res = await fetch(`${BASE_URL}/api/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ title: "Hack Service", category: "AC", basePrice: 100 }),
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 8. Role Guard: Technician cannot book a service
  await test("RBAC Guard: Technician cannot send a booking request (403 Forbidden)", async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${techToken}`,
      },
      body: JSON.stringify({ serviceId: sampleService?._id || "507f1f77bcf86cd799439011" }),
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 9. Booking Validation: Past Date Rejected
  await test("Booking Validation: Past preferred date rejected (400 Bad Request)", async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        serviceId: sampleService?._id || "507f1f77bcf86cd799439011",
        preferredDate: "2020-01-01",
        address: "Test Address, Dhaka",
        customerPhone: "01711000000",
        problemDescription: "This problem description is definitely more than 20 characters long.",
      }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 10. Booking Validation: Short Description (<20 chars) Rejected
  await test("Booking Validation: Description < 20 chars rejected (400 Bad Request)", async () => {
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        serviceId: sampleService?._id || "507f1f77bcf86cd799439011",
        preferredDate: "2026-12-01",
        address: "Test Address, Dhaka",
        customerPhone: "01711000000",
        problemDescription: "Too short",
      }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 11. End-to-End: Valid Booking Created
  let dynamicBookingId = null;
  await test("Booking Creation: Valid booking created successfully (201 Created)", async () => {
    if (!sampleService) throw new Error("No sample service found in database to book");
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        serviceId: sampleService._id,
        preferredDate: "2026-12-15",
        address: "House 10, Road 4, Dhanmondi, Dhaka",
        customerPhone: "01711223344",
        problemDescription: "My air conditioner is blowing warm air and making unusual humming sounds.",
      }),
    });
    if (res.status !== 201) {
      const err = await res.json();
      throw new Error(`Expected 201, got ${res.status}: ${err.message}`);
    }
    const data = await res.json();
    dynamicBookingId = data.bookingId;
    if (!dynamicBookingId) throw new Error("bookingId missing in 201 response");
  });

  // 12. Duplicate Active Booking Rejected
  await test("Booking Duplicate Check: Duplicate active request for same service rejected (400)", async () => {
    if (!sampleService) return "SKIP";
    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        serviceId: sampleService._id,
        preferredDate: "2026-12-20",
        address: "Another address, Dhaka",
        customerPhone: "01711223344",
        problemDescription: "Attempting to create another duplicate active request for same service.",
      }),
    });
    if (res.status !== 400) throw new Error(`Expected 400 duplicate rejection, got ${res.status}`);
  });

  // 13. State Machine & Ownership: Only the owner technician can update booking status
  await test("State Machine Ownership: Non-owner technician cannot update status (404/403)", async () => {
    if (!dynamicBookingId) return "SKIP";
    const res = await fetch(`${BASE_URL}/api/bookings/${dynamicBookingId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${nonOwnerTechToken}`,
      },
      body: JSON.stringify({ status: "accepted" }),
    });
    if (res.status !== 404 && res.status !== 403) {
      throw new Error(`Expected 404/403 for non-owner technician, got ${res.status}`);
    }
  });

  // 14. State Machine: Owner technician accepts booking (requested -> accepted)
  await test("State Machine Transition: Owner technician accepts booking (requested -> accepted)", async () => {
    if (!dynamicBookingId) return "SKIP";
    const res = await fetch(`${BASE_URL}/api/bookings/${dynamicBookingId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTechToken}`,
      },
      body: JSON.stringify({ status: "accepted" }),
    });
    if (res.status !== 200) {
      const err = await res.json();
      throw new Error(`Expected 200, got ${res.status}: ${err.message}`);
    }
  });

  // 15. Customer Cancellation Guard: Customer cannot cancel once status is 'accepted'
  await test("Cancellation Guard: Customer cannot cancel booking once 'accepted' (400)", async () => {
    if (!dynamicBookingId) return "SKIP";
    const res = await fetch(`${BASE_URL}/api/bookings/${dynamicBookingId}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 (only requested can be cancelled), got ${res.status}`);
    }
  });

  // 16. State Machine: accepted -> in-progress
  await test("State Machine Transition: accepted -> in-progress passes", async () => {
    if (!dynamicBookingId) return "SKIP";
    const res = await fetch(`${BASE_URL}/api/bookings/${dynamicBookingId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTechToken}`,
      },
      body: JSON.stringify({ status: "in-progress" }),
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // 17. State Machine: in-progress -> completed requires finalAmount > 0
  await test("State Machine Completion Guard: in-progress -> completed without finalAmount rejected (400)", async () => {
    if (!dynamicBookingId) return "SKIP";
    const res = await fetch(`${BASE_URL}/api/bookings/${dynamicBookingId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTechToken}`,
      },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 18. State Machine: in-progress -> completed with finalAmount passes
  await test("State Machine Completion: in-progress -> completed with finalAmount passes", async () => {
    if (!dynamicBookingId) return "SKIP";
    const res = await fetch(`${BASE_URL}/api/bookings/${dynamicBookingId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTechToken}`,
      },
      body: JSON.stringify({ status: "completed", finalAmount: 45 }),
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // 19. Payment Ownership Gate: Checkout session rejected for another customer's booking (403)
  await test("Payment Ownership Gate: Customer cannot checkout another customer's booking (403)", async () => {
    if (!dynamicBookingId) return "SKIP";
    const res = await fetch(`${BASE_URL}/api/payments/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${otherCustomerToken}`,
      },
      body: JSON.stringify({ bookingId: dynamicBookingId }),
    });
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  // 20. Payment Already Paid Gate: Checkout session rejected for already paid booking (400)
  await test("Payment Gate: Checkout session rejected for already paid booking (400)", async () => {
    const bookingsRes = await fetch(`${BASE_URL}/api/bookings/my`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (bookingsRes.status === 200) {
      const allBookings = await bookingsRes.json();
      const paidBooking = allBookings.find((b) => b.paymentStatus === "paid");
      if (paidBooking) {
        const res = await fetch(`${BASE_URL}/api/payments/create-checkout-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${customerToken}`,
          },
          body: JSON.stringify({ bookingId: paidBooking._id }),
        });
        if (res.status !== 400) throw new Error(`Expected 400 for already paid booking, got ${res.status}`);
      }
    }
  });

  // 21. Admin Self-Role Demotion Guard
  await test("Admin Security: Admin cannot demote/change own role (400 Bad Request)", async () => {
    const usersRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (usersRes.status === 200) {
      const usersList = await usersRes.json();
      const adminUser = usersList.find((u) => u.email === "admin@fixmate.com");
      if (adminUser) {
        const updateRes = await fetch(`${BASE_URL}/api/admin/users/${adminUser._id}/role`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ role: "customer" }),
        });
        if (updateRes.status !== 400) throw new Error(`Expected 400, got ${updateRes.status}`);
      }
    }
  });

  // 22. Profile Whitelist Security: Cannot modify role or email
  await test("Profile Whitelist: Updating profile cannot change email or role", async () => {
    const res = await fetch(`${BASE_URL}/api/users/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        role: "admin",
        email: "hacker@fixmate.com",
        bio: "Updated bio safely",
      }),
    });
    if (res.status === 200) {
      const data = await res.json();
      if (data.user?.role === "admin" || data.user?.email === "hacker@fixmate.com") {
        throw new Error("Mass-assignment vulnerability! Role or email was altered!");
      }
    }
  });

  // 23. Stripe Webhook Signature Guard
  await test("Webhook Security: Webhook rejects invalid stripe signature (400)", async () => {
    const res = await fetch(`${BASE_URL}/api/payments/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=123,v1=fake_signature",
      },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  // 24. Live Stripe Checkout Session
  await test("Live Stripe Interactive Checkout", async () => {
    return "SKIP";
  });

  console.log("\n=======================================================");
  console.log(` Summary: \x1b[32m${passed} Passed\x1b[0m | \x1b[31m${failed} Failed\x1b[0m | \x1b[33m${skipped} Skipped\x1b[0m`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
