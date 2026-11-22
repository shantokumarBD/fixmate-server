# FixMate Backend API Contract & Specification

**Standard:** Assignment 9 (Category 006: Smart Device & Home Appliance Repair Service Platform)  
**Backend Architecture:** Node.js (ES Modules), Express 5, MongoDB Native Driver, Stripe SDK, HS256 JWT RBAC  
**Base URL:** `http://localhost:5000` (Development) / `https://<production-domain>` (Production)  

---

## 1. Authentication & Security Protocols

### 1.1 Bearer Token Header
All protected endpoints require the standard `Authorization` header containing a JSON Web Token (JWT):
```http
Authorization: Bearer <JWT_TOKEN>
```

### 1.2 JWT Requirements & Hardening
- **Algorithm:** Pinned strictly to `HS256` to prevent algorithm-switching attacks.
- **Mandatory Claims:** 
  - `email`: User identity claim used for database lookup and permission checks.
  - `exp`: Token expiry timestamp (tokens missing `exp` are rejected with `401 Unauthorized`).
- **Database Verification:** `verifyToken` middleware validates user existence in the MongoDB `user` collection on every request, ensuring administrative role changes take effect immediately without token re-issuance.

### 1.3 Role-Based Access Control (RBAC)
| Role | Description |
|:---|:---|
| `customer` | Requests repair services, manages own bookings, pays completed services, views own payment history. |
| `technician` | Creates and manages repair service listings, toggles availability, updates assigned booking statuses. |
| `admin` | Moderates services (approve/reject), manages user roles, audits all bookings and transactions, views platform analytics. |

---

## 2. Standard HTTP Status Codes

| Code | Status | Meaning |
|:---:|:---|:---|
| `200` | OK | Request succeeded. |
| `201` | Created | Resource successfully created. |
| `400` | Bad Request | Validation failed, missing required fields, or illegal state transition. |
| `401` | Unauthorized | Missing, expired, forged, or unauthenticated JWT token. |
| `403` | Forbidden | Authenticated user lacks sufficient role or does not own the target resource. |
| `404` | Not Found | Target resource does not exist or user lacks permission to access it. |
| `409` | Conflict | Concurrent update race condition detected (e.g. concurrent booking state change). |
| `500` | Internal Server Error | Unhandled server exception. |

---

## 3. Services API (`/api/services`)

### 3.1 List Services (Public)
Fetches approved and available repair services with server-side filtering, searching, sorting, and pagination limits.

- **Method:** `GET`
- **Path:** `/api/services`
- **Access:** Public (No auth required)
- **Filters Applied by Server:** `approvalStatus: "approved"`, `isAvailable: true`
- **Query Parameters:**
  - `search` *(string, optional)*: Case-insensitive search on `title` or `category` (special regex characters are escaped against ReDoS).
  - `category` *(string, optional)*: Filter by exact category name (e.g. `AC`, `Refrigerator`, `Smartphone`, `Laptop & PC`, `TV`, `Washing Machine`, `Electrical`).
  - `serviceMode` *(string, optional)*: Filter by `'Home Visit'` or `'Shop Drop-off'`.
  - `sort` *(string, optional)*:
    - `price_asc` or `asc`: Lowest base price first (`basePrice: 1`).
    - `price_desc` or `desc`: Highest base price first (`basePrice: -1`).
    - `newest`: Most recently created first (`createdAt: -1`). Default: `newest`.
  - `limit` *(number, optional)*: Maximum number of records to return (e.g. `?limit=6` for Home page featured services).
- **Response `200 OK`:**
```json
[
  {
    "_id": "673cf1000000000000000001",
    "title": "AC Jet Pump Deep Cleaning & Gas Refill",
    "category": "AC",
    "description": "Complete indoor and outdoor unit jet-pump chemical wash...",
    "image": "https://images.unsplash.com/...",
    "basePrice": 35,
    "estimatedDuration": "2 - 3 Hours",
    "serviceMode": "Home Visit",
    "serviceArea": "Dhaka (Mirpur, Gulshan, Dhanmondi, Uttara)",
    "technicianName": "Rahim Chowdhury",
    "technicianEmail": "rahim.tech@fixmate.com",
    "approvalStatus": "approved",
    "isAvailable": true,
    "createdAt": "2026-11-14T00:00:00.000Z"
  }
]
```

---

### 3.2 Get Service Details (Public)
Retrieves a single service by ID and joins the technician's profile summary from the `user` collection.

- **Method:** `GET`
- **Path:** `/api/services/:id`
- **Access:** Public (Must be `approved` and `isAvailable: true`)
- **Response `200 OK`:**
```json
{
  "_id": "673cf1000000000000000001",
  "title": "AC Jet Pump Deep Cleaning & Gas Refill",
  "category": "AC",
  "description": "Complete indoor and outdoor unit chemical wash...",
  "image": "https://images.unsplash.com/...",
  "basePrice": 35,
  "estimatedDuration": "2 - 3 Hours",
  "serviceMode": "Home Visit",
  "serviceArea": "Dhaka (Mirpur, Gulshan, Dhanmondi, Uttara)",
  "technicianName": "Rahim Chowdhury",
  "technicianEmail": "rahim.tech@fixmate.com",
  "approvalStatus": "approved",
  "isAvailable": true,
  "createdAt": "2026-11-14T00:00:00.000Z",
  "technician": {
    "name": "Rahim Chowdhury",
    "image": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?...",
    "area": "Mirpur & Dhanmondi, Dhaka",
    "bio": "Master Technician with 8+ years experience in AC and Refrigerator repairs.",
    "phone": "+8801711000002"
  }
}
```
- **Error Responses:**
  - `404 Not Found`: Service does not exist, is not approved, or is set to unavailable.

---

### 3.3 Create Service (Technician)
Creates a new service listing. Server sets `approvalStatus: "pending"` and `isAvailable: true` by default.

- **Method:** `POST`
- **Path:** `/api/services`
- **Access:** Technician (`verifyToken`, `verifyTechnician`)
- **Request Body:**
```json
{
  "title": "Inverter AC PCB Board Repair",
  "category": "AC",
  "description": "Chip-level repair of inverter AC PCB boards.",
  "image": "https://images.unsplash.com/...",
  "basePrice": 50,
  "estimatedDuration": "4 - 5 Hours",
  "serviceMode": "Shop Drop-off",
  "serviceArea": "Central Service Hub, Mirpur 10"
}
```
- **Validation Rules:**
  - `title`, `category`, and `basePrice` are required.
  - `serviceMode` must strictly be either `'Home Visit'` or `'Shop Drop-off'`.
- **Response `201 Created`:**
```json
{
  "success": true,
  "insertedId": "673cf2000000000000000002"
}
```

---

### 3.4 Get Own Services (Technician)
Retrieves all services created by the authenticated technician (including pending, approved, and rejected).

- **Method:** `GET`
- **Path:** `/api/services/my`
- **Access:** Technician (`verifyToken`, `verifyTechnician`)
- **Response `200 OK`:** Array of service objects owned by `req.user.email`.

---

### 3.5 Update Service (Technician)
Updates an existing service listing owned by the authenticated technician. Any edit automatically resets `approvalStatus: "pending"` for administrative review.

- **Method:** `PATCH`
- **Path:** `/api/services/:id`
- **Access:** Technician (`verifyToken`, `verifyTechnician`, Ownership verified)
- **Request Body:** Partial update fields (`title`, `category`, `description`, `image`, `basePrice`, `estimatedDuration`, `serviceMode`, `serviceArea`).
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Service updated successfully"
}
```

---

### 3.6 Delete Service (Technician)
Permanently deletes a service owned by the authenticated technician.

- **Method:** `DELETE`
- **Path:** `/api/services/:id`
- **Access:** Technician (`verifyToken`, `verifyTechnician`, Ownership verified)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Service deleted successfully"
}
```

---

### 3.7 Toggle Service Availability (Technician)
Toggles the technician's real-time availability for a service without resetting or altering administrative approval status.

- **Method:** `PATCH`
- **Path:** `/api/services/:id/availability`
- **Access:** Technician (`verifyToken`, `verifyTechnician`, Ownership verified)
- **Request Body:**
```json
{
  "isAvailable": false
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Service availability set to unavailable",
  "isAvailable": false
}
```

---

## 4. Bookings API (`/api/bookings`)

### 4.1 Booking Status State Machine
```
[requested] ──(Technician accepts)──> [accepted] ──(Technician starts)──> [in-progress] ──(Technician completes)──> [completed]
     │                                                                                                                  │
     ├──(Technician rejects)──> [rejected]                                                                              ▼
     │                                                                                                        [Stripe Pay-After-Service]
     └──(Customer cancels)───> [cancelled]
```

- **Strict Transitions:**
  - `requested` $\to$ `accepted`, `rejected`, or `cancelled`
  - `accepted` $\to$ `in-progress`
  - `in-progress` $\to$ `completed`
- **Completion Requirement:** Transition to `completed` strictly requires `finalAmount > 0`.
- **Cancellation Rule:** Customer can **only** cancel when status is strictly `'requested'`. Once `'accepted'`, cancellation is rejected (`400 Bad Request`).

---

### 4.2 Create Booking (Customer)
Creates a new booking request for an approved repair service.

- **Method:** `POST`
- **Path:** `/api/bookings`
- **Access:** Customer (`verifyToken`, `verifyCustomer`)
- **Request Body:**
```json
{
  "serviceId": "673cf1000000000000000001",
  "preferredDate": "2026-12-15",
  "timeSlot": "10:00 AM - 12:00 PM",
  "address": "House 10, Road 4, Dhanmondi, Dhaka",
  "customerPhone": "+8801711223344",
  "problemDescription": "AC indoor unit is blowing warm air and making unusual humming sounds."
}
```
- **Validation Rules:**
  - Required fields: `serviceId`, `preferredDate`, `address`, `customerPhone` (or `phone`), `problemDescription`.
  - `problemDescription`: Must be at least 20 characters long.
  - `preferredDate`: Must be today or a future date (time-zone safe).
  - Duplicate check: Customer cannot submit a duplicate booking for the same service while an active booking exists (`requested`, `accepted`, or `in-progress`).
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Booking requested successfully",
  "bookingId": "673cf3000000000000000003"
}
```

---

### 4.3 Get My Bookings (Customer)
Retrieves all bookings submitted by the authenticated customer.

- **Method:** `GET`
- **Path:** `/api/bookings/my`
- **Access:** Customer (`verifyToken`, `verifyCustomer`)
- **Response `200 OK`:** Array of booking documents sorted by `createdAt: -1`.

---

### 4.4 Get Assigned Bookings (Technician)
Retrieves all bookings assigned to the authenticated technician.

- **Method:** `GET`
- **Path:** `/api/bookings/technician`
- **Access:** Technician (`verifyToken`, `verifyTechnician`)
- **Response `200 OK`:** Array of booking documents assigned to `req.user.email`.

---

### 4.5 Get Booking Details
Retrieves details for a single booking by ID. Accessible only by the booking's customer, assigned technician, or an admin.

- **Method:** `GET`
- **Path:** `/api/bookings/:id`
- **Access:** Authenticated (`req.user.email` must match `customerEmail` or `technicianEmail`, or `role === "admin"`)
- **Response `200 OK`:** Full booking document.
- **Error Responses:**
  - `403 Forbidden`: Authenticated user is not a party to this booking.
  - `404 Not Found`: Booking ID does not exist.

---

### 4.6 Update Booking Status (Technician)
Transitions the booking through the service lifecycle.

- **Method:** `PATCH`
- **Path:** `/api/bookings/:id/status`
- **Access:** Technician (`verifyToken`, `verifyTechnician`, Ownership verified)
- **Request Body (Standard Transition):**
```json
{
  "status": "accepted"
}
```
- **Request Body (Completion Transition):**
```json
{
  "status": "completed",
  "finalAmount": 45
}
```
- **Rules:**
  - `finalAmount > 0` is strictly mandatory when `status === "completed"`.
  - Uses atomic condition matching (`updateOne({ _id, status: currentStatus })`) to protect against concurrent modification races (`409 Conflict`).
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Booking status updated to completed"
}
```

---

### 4.7 Cancel Booking (Customer)
Cancels a pending booking. Allowed **only** while status is `'requested'`.

- **Method:** `PATCH`
- **Path:** `/api/bookings/:id/cancel`
- **Access:** Customer (`verifyToken`, `verifyCustomer`, Ownership verified)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Booking cancelled successfully"
}
```
- **Error Responses:**
  - `400 Bad Request`: Booking status is `accepted`, `in-progress`, or `completed`.

---

## 5. Payments API (`/api/payments`)

### 5.1 Create Stripe Checkout Session (Customer)
Creates a hosted Stripe Checkout Session for a completed booking under the Pay-After-Service model.

- **Method:** `POST`
- **Path:** `/api/payments/create-checkout-session`
- **Access:** Customer (`verifyToken`, `verifyCustomer`, Ownership verified)
- **Request Body:**
```json
{
  "bookingId": "673cf3000000000000000003"
}
```
- **Guards Enforced:**
  - Booking `status` must strictly be `'completed'`.
  - Booking `paymentStatus` must strictly be `'unpaid'`.
  - Customer ownership: `booking.customerEmail === req.user.email` (`403 Forbidden` otherwise).
  - `booking.finalAmount > 0` must be present.
- **Response `200 OK`:**
```json
{
  "success": true,
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "sessionId": "cs_test_a1b2c3d4..."
}
```

---

### 5.2 Verify Payment (Customer Return Redirect)
Called by the client return page (`/payment/success?session_id=...`) to verify settlement.

- **Method:** `GET` or `POST`
- **Path:** `/api/payments/verify`
- **Access:** Authenticated (`verifyToken`)
- **Query / Body Parameter:**
  - Query: `?session_id=cs_test_...`
  - Body: `{ "sessionId": "cs_test_..." }`
- **Verification Logic:**
  - Retrieves session directly from Stripe API.
  - Verifies `session.metadata.customerEmail === req.user.email` (`403 Forbidden` if mismatched).
  - Idempotently updates booking `paymentStatus: "paid"`, `transactionId`, `paidAt`.
  - Idempotently inserts payment audit record into `payments` collection (guarded by unique index on `stripeSessionId`).
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "payment": {
    "bookingId": "673cf3000000000000000003",
    "serviceTitle": "AC Jet Pump Deep Cleaning & Gas Refill",
    "customerName": "Shanto Customer",
    "customerEmail": "shanto.customer@gmail.com",
    "technicianName": "Rahim Chowdhury",
    "technicianEmail": "rahim.tech@fixmate.com",
    "amount": 45,
    "currency": "usd",
    "transactionId": "pi_3MtwBwLkdIwHu7ix28a3tqPa",
    "stripeSessionId": "cs_test_a1b2c3d4...",
    "paymentStatus": "paid",
    "paidAt": "2026-11-20T05:00:00.000Z"
  }
}
```

---

### 5.3 Get My Payments (Customer)
Fetches all settled payments made by the authenticated customer.

- **Method:** `GET`
- **Path:** `/api/payments/my`
- **Access:** Customer (`verifyToken`, `verifyCustomer`)
- **Response `200 OK`:** Array of payment records sorted by `paidAt: -1`.

---

### 5.4 Stripe Webhook Listener
Receives asynchronous webhook events directly from Stripe servers.

- **Method:** `POST`
- **Path:** `/api/payments/webhook`
- **Access:** Public (Signature Verified via `stripe-signature` header)
- **Body Requirement:** Raw request buffer (parsed prior to `express.json()`).
- **Secret:** `process.env.STRIPE_WEBHOOK_SECRET`
- **Handled Event:** `checkout.session.completed`
- **Response:**
  - `200 OK`: `{ "received": true }`
  - `400 Bad Request`: Missing or invalid Stripe signature.

---

## 6. Admin API (`/api/admin`)

All routes under `/api/admin` require both `verifyToken` and `verifyAdmin` (`role === "admin"`).

### 6.1 Platform Analytics & Overview Stats
Aggregates summary statistics for the 6 Admin Dashboard metric cards.

- **Method:** `GET`
- **Path:** `/api/admin/stats`
- **Response `200 OK`:**
```json
{
  "totalUsers": 25,
  "totalTechnicians": 8,
  "totalServices": 14,
  "pendingServices": 3,
  "totalBookings": 42,
  "totalRevenue": 1850
}
```

---

### 6.2 Get All Services (Admin)
Retrieves all services in the system across all approval states.

- **Method:** `GET`
- **Path:** `/api/admin/services`
- **Response `200 OK`:** Array of all service objects sorted newest first.

---

### 6.3 Update Service Approval (Admin)
Approves or rejects a submitted repair service.

- **Method:** `PATCH`
- **Path:** `/api/admin/services/:id/approval`
- **Request Body:**
```json
{
  "approvalStatus": "approved"
}
```
- **Allowed Values:** `'approved'` or `'rejected'`.
- **Preservation Rule:** Modifies only `approvalStatus`; does not overwrite or alter the technician's `isAvailable` setting.
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Service has been approved successfully"
}
```

---

### 6.4 Get All Users (Admin)
Retrieves all registered users. Passwords are automatically excluded via projection.

- **Method:** `GET`
- **Path:** `/api/admin/users`
- **Response `200 OK`:** Array of user profiles (`password` field excluded).

---

### 6.5 Update User Role (Admin)
Promotes or changes a user's role.

- **Method:** `PATCH`
- **Path:** `/api/admin/users/:id/role`
- **Request Body:**
```json
{
  "role": "technician"
}
```
- **Allowed Roles:** `'customer'`, `'technician'`, `'admin'`.
- **Self-Demotion Guard:** An admin cannot modify their own role (`400 Bad Request`) to prevent accidental platform lockouts.
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "User role updated to technician successfully"
}
```

---

### 6.6 Get All Bookings (Admin)
Retrieves all booking orders across the entire platform.

- **Method:** `GET`
- **Path:** `/api/admin/bookings`
- **Response `200 OK`:** Array of all booking documents.

---

### 6.7 Get All Payments & Revenue Audit (Admin)
Audits all settled payment records with total accumulated platform revenue.

- **Method:** `GET`
- **Path:** `/api/admin/payments`
- **Response `200 OK`:**
```json
{
  "payments": [ ... ],
  "totalRevenue": 1850
}
```

---

## 7. Users & Profile API (`/api/users`)

All routes require authentication (`verifyToken`).

### 7.1 Get Current User Profile
Retrieves the logged-in user's profile details with sensitive credentials excluded.

- **Method:** `GET`
- **Path:** `/api/users/me`
- **Access:** Authenticated
- **Response `200 OK`:**
```json
{
  "_id": "673cf0000000000000000001",
  "name": "Shanto Customer",
  "email": "shanto.customer@gmail.com",
  "role": "customer",
  "phone": "+8801711223344",
  "area": "Dhanmondi, Dhaka",
  "bio": "Smart home enthusiast and regular FixMate customer.",
  "image": "https://images.unsplash.com/...",
  "createdAt": "2026-11-10T00:00:00.000Z"
}
```

---

### 7.2 Update User Profile
Updates personal profile fields for the authenticated user.

- **Method:** `PATCH`
- **Path:** `/api/users/profile`
- **Access:** Authenticated
- **Request Body:**
```json
{
  "name": "Shanto Ahmed",
  "phone": "+8801711998877",
  "area": "Gulshan 2, Dhaka",
  "bio": "Certified tech reviewer and smart home user.",
  "image": "https://images.unsplash.com/..."
}
```
- **Strict Security Whitelist:** Only `name`, `phone`, `area`, `bio`, and `image` can be modified. Attempts to update `email` or `role` are silently ignored on the server to prevent privilege escalation and identity spoofing.
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": { ... }
}
```

---

## 8. Summary of API Endpoints

| # | Method | Path | Access / Role | Description |
|:---:|:---:|:---|:---|:---|
| 1 | `GET` | `/` | Public | Server health check root |
| 2 | `GET` | `/api/services` | Public | List approved services with search, filter, sort & limit |
| 3 | `GET` | `/api/services/:id` | Public | Get approved service details with technician profile join |
| 4 | `GET` | `/api/services/my` | Technician | Get all services created by logged-in technician |
| 5 | `POST` | `/api/services` | Technician | Create a new repair service (auto `approvalStatus: pending`) |
| 6 | `PATCH` | `/api/services/:id` | Technician | Update own service (resets `approvalStatus: pending`) |
| 7 | `DELETE` | `/api/services/:id` | Technician | Delete own service |
| 8 | `PATCH` | `/api/services/:id/availability` | Technician | Toggle service availability without resetting approval |
| 9 | `POST` | `/api/bookings` | Customer | Create booking request (validation + duplicate active check) |
| 10 | `GET` | `/api/bookings/my` | Customer | Get own bookings |
| 11 | `GET` | `/api/bookings/technician` | Technician | Get assigned bookings |
| 12 | `GET` | `/api/bookings/:id` | Customer / Tech / Admin | Get single booking details (ownership-gated) |
| 13 | `PATCH` | `/api/bookings/:id/status` | Technician | Update status (`requested` $\to$ `accepted` $\to$ `in-progress` $\to$ `completed`) |
| 14 | `PATCH` | `/api/bookings/:id/cancel` | Customer | Cancel own booking (only allowed when `status === requested`) |
| 15 | `POST` | `/api/payments/create-checkout-session` | Customer | Create Stripe checkout session (Pay-After-Service) |
| 16 | `GET` | `/api/payments/verify` | Authenticated | Verify Stripe payment redirect & idempotent settlement |
| 17 | `POST` | `/api/payments/verify` | Authenticated | Fallback verify with body `{ sessionId }` |
| 18 | `GET` | `/api/payments/my` | Customer | Get own payment transaction history |
| 19 | `POST` | `/api/payments/webhook` | Stripe (Public) | Asynchronous webhook listener (`checkout.session.completed`) |
| 20 | `GET` | `/api/admin/stats` | Admin | Platform overview metrics (6 dashboard analytics cards) |
| 21 | `GET` | `/api/admin/services` | Admin | View all services across platform |
| 22 | `PATCH` | `/api/admin/services/:id/approval` | Admin | Moderate service (`approvalStatus: approved/rejected`) |
| 23 | `GET` | `/api/admin/users` | Admin | View all registered users (password excluded) |
| 24 | `PATCH` | `/api/admin/users/:id/role` | Admin | Update user role (prevents self-demotion) |
| 25 | `GET` | `/api/admin/bookings` | Admin | View all platform bookings |
| 26 | `GET` | `/api/admin/payments` | Admin | View all transaction logs + total revenue |
| 27 | `GET` | `/api/users/me` | Authenticated | Get own profile details (password excluded) |
| 28 | `PATCH` | `/api/users/profile` | Authenticated | Update profile (whitelisted: name, phone, area, bio, image) |
