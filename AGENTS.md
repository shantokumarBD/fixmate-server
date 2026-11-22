# FixMate Server Agent Map & API Architecture Reference

> **FixMate Backend** is an Express 5 REST API gateway built with Node.js (ES Modules), MongoDB Native Driver, Stripe Payment SDK, and HS256 JWT verification.

---

## 1. ROUTE TABLE & ENDPOINT MAP

| Method | Path | Middlewares | Controller Function | Access Role | Description |
|:---:|:---|:---|:---|:---:|:---|
| `GET` | `/` | None | Inline Handler | Public | Server health status |
| `GET` | `/api/services` | None | `getAllServices` | Public | List approved services with filter/search/sort/limit |
| `GET` | `/api/services/:id` | None | `getServiceById` | Public | Service details with technician profile join |
| `GET` | `/api/services/my` | `verifyToken`, `verifyTechnician` | `getMyServices` | `technician` | List technician's own services |
| `POST` | `/api/services` | `verifyToken`, `verifyTechnician` | `createService` | `technician` | Create new repair service (status: pending) |
| `PATCH` | `/api/services/:id` | `verifyToken`, `verifyTechnician` | `updateService` | `technician` (Owner) | Update own service (resets approval to pending) |
| `DELETE` | `/api/services/:id` | `verifyToken`, `verifyTechnician` | `deleteService` | `technician` (Owner) | Delete technician's own service |
| `PATCH` | `/api/services/:id/availability` | `verifyToken`, `verifyTechnician` | `toggleAvailability` | `technician` (Owner) | Toggle availability without resetting approval |
| `POST` | `/api/bookings` | `verifyToken`, `verifyCustomer` | `createBooking` | `customer` | Submit repair booking (min 20 char desc, future date) |
| `GET` | `/api/bookings/my` | `verifyToken`, `verifyCustomer` | `getMyBookings` | `customer` | List customer's own repair bookings |
| `PATCH` | `/api/bookings/:id/cancel` | `verifyToken`, `verifyCustomer` | `cancelBooking` | `customer` (Owner) | Cancel booking (only valid while status is requested) |
| `GET` | `/api/bookings/technician` | `verifyToken`, `verifyTechnician` | `getTechnicianBookings` | `technician` | List bookings assigned to logged-in technician |
| `PATCH` | `/api/bookings/:id/status` | `verifyToken`, `verifyTechnician` | `updateBookingStatus` | `technician` (Owner) | Pipeline state machine update (completed requires finalAmount > 0) |
| `GET` | `/api/bookings/:id` | `verifyToken` | `getBookingById` | Authenticated | View single booking (customer, technician, or admin) |
| `POST` | `/api/payments/create-checkout-session` | `verifyToken`, `verifyCustomer` | `createCheckoutSession` | `customer` (Owner) | Stripe Checkout session (only if completed and unpaid) |
| `GET` | `/api/payments/verify` | `verifyToken`, `verifyCustomer` | `verifyPayment` | `customer` (Owner) | Verify Stripe payment session and settle booking |
| `GET` | `/api/payments/my` | `verifyToken`, `verifyCustomer` | `getMyPayments` | `customer` | List customer's paid transactions |
| `POST` | `/api/payments/webhook` | `express.raw({ type: "application/json" })` | `handleStripeWebhook` | Stripe Server | Cryptographic webhook listener for payment settlement |
| `GET` | `/api/admin/stats` | `verifyToken`, `verifyAdmin` | `getPlatformStats` | `admin` | Aggregated platform-wide counters and revenue |
| `GET` | `/api/admin/users` | `verifyToken`, `verifyAdmin` | `getAllUsers` | `admin` | List all users (excluding password hashes) |
| `PATCH` | `/api/admin/users/:id/role` | `verifyToken`, `verifyAdmin` | `updateUserRole` | `admin` | Change user role (self-role change blocked) |
| `GET` | `/api/admin/services` | `verifyToken`, `verifyAdmin` | `getAllServicesForAdmin` | `admin` | List all services across platform |
| `PATCH` | `/api/admin/services/:id/approval` | `verifyToken`, `verifyAdmin` | `updateServiceApproval` | `admin` | Approve or reject technician service listing |
| `GET` | `/api/admin/bookings` | `verifyToken`, `verifyAdmin` | `getAllBookings` | `admin` | Audit log of all bookings across platform |
| `GET` | `/api/admin/payments` | `verifyToken`, `verifyAdmin` | `getAllPayments` | `admin` | Audit log of all payments and gross revenue |
| `GET` | `/api/users/me` | `verifyToken` | `getMyProfile` | Authenticated | Get current user profile |
| `PATCH` | `/api/users/profile` | `verifyToken` | `updateProfile` | Authenticated | Whitelist profile update (name, phone, area, bio, image) |

---

## 2. AUTHENTICATION & RBAC ARCHITECTURE

1. **Token Extraction:** Middleware reads `Authorization: Bearer <token>` header.
2. **Algorithm Pinning:** `jwt.verify(token, secret, { algorithms: ["HS256"] })` strictly pins `HS256` to prevent algorithm-switching attacks.
3. **Mandatory Claims:** Enforces `exp` (must not be expired) and `email` (identity claim).
4. **Live Database Synchronization:** Fetches the user record from the MongoDB `user` collection by `email` on every request. This ensures administrative role changes take effect immediately without requiring token re-issuance.
5. **Role Middleware Guards:**
   - `verifyCustomer`: Blocks request with 403 Forbidden if `req.user.role !== "customer"`.
   - `verifyTechnician`: Blocks request with 403 Forbidden if `req.user.role !== "technician"`.
   - `verifyAdmin`: Blocks request with 403 Forbidden if `req.user.role !== "admin"`.

---

## 3. STATE MACHINE PIPELINE

```javascript
export const VALID_TRANSITIONS = {
  requested: ["accepted", "rejected", "cancelled"],
  accepted: ["in-progress"],
  "in-progress": ["completed"],
  completed: [], // Terminal
  rejected: [],  // Terminal
  cancelled: [], // Terminal
};
```

### Business Rules Enforced in Controllers:
- **Customer Cancellation:** Only allowed while status is `requested`. Once accepted, cancellation is blocked.
- **Completion Final Amount:** Transition to `completed` strictly requires `finalAmount > 0`.
- **Atomic Modification:** Status updates use conditional atomic query `{ _id: id, status: currentStatus }` to prevent concurrent modification race conditions (rejects with 409 Conflict).
- **Service Edits:** Any service update by technician resets `approvalStatus` to `pending`.
- **Availability Toggle:** Toggling `isAvailable` does NOT reset `approvalStatus`.

---

## 4. PAYMENTS & IDEMPOTENCY ARCHITECTURE

1. **Pay-After-Service Model:**
   - Pre-condition: `booking.status === "completed"` AND `booking.paymentStatus === "unpaid"`.
   - Amount Enforcement: Charge amount is read strictly from `booking.finalAmount` in database; client-supplied amounts are ignored.
2. **Webhook Middleware Mount Order:**
   - Mounted strictly with `express.raw({ type: "application/json" })` **before** `express.json()`.
   - Validates cryptographic HMAC signature using `stripe.webhooks.constructEvent`.
3. **Four-Layer Idempotency Safeguards:**
   - Layer 1: Query `payments` by `stripeSessionId` before creating records.
   - Layer 2: Atomic update on booking with condition `{ _id: bookingId, paymentStatus: "unpaid" }`.
   - Layer 3: Unique database index on `payments.stripeSessionId` created at startup.
   - Layer 4: Catch and safely ignore duplicate key error code 11000.

---

## 5. DATABASE COLLECTIONS & INDEXING

| Collection Name | Key Fields | Production Indexes |
|:---|:---|:---|
| `user` | `name`, `email`, `role`, `phone`, `area`, `bio`, `image`, `createdAt` | `email` (unique) |
| `services` | `title`, `category`, `basePrice`, `serviceMode`, `technicianEmail`, `approvalStatus`, `isAvailable` | `{ approvalStatus: 1, isAvailable: 1, category: 1, basePrice: 1 }` |
| `bookings` | `serviceId`, `customerEmail`, `technicianEmail`, `status`, `finalAmount`, `paymentStatus`, `createdAt` | `{ customerEmail: 1, createdAt: -1 }`, `{ technicianEmail: 1, status: 1 }` |
| `payments` | `bookingId`, `customerEmail`, `technicianEmail`, `amount`, `transactionId`, `stripeSessionId`, `paidAt` | `{ stripeSessionId: 1 }` (unique) |

---

## 6. ENVIRONMENT VARIABLES & OPERATIONAL COMMANDS

### Required Environment Variable Names (No Values)
- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Permitted Verification Commands
```bash
npm start             # Start Express production server
npm run dev           # Start Express development server with nodemon
npm audit             # Audit package vulnerabilities
```

### Prohibited Actions (Do Not Touch)
- Do NOT edit files during read-only audit sessions.
- Do NOT run database seed scripts or wipe scripts against production databases.
- Do NOT expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` to the client.
- Do NOT bypass `verifyToken` or role middlewares on private endpoints.

### Audit & Reference Documents Index
- Architecture & Lifecycles: `../docs/audit/01-ARCHITECTURE.md`
- Server Deep Review: `../docs/audit/03-SERVER-REVIEW.md`
- Requirements Matrix: `../docs/audit/04-REQUIREMENTS-MATRIX.md`
- Security & Deployment: `../docs/audit/05-SECURITY-QUALITY-DEPLOYMENT.md`
- Fix Plan: `../docs/audit/06-FIX-PLAN.md`
- Platform Engineering Playbook: `../docs/PLAYBOOK-role-based-platform.md`
