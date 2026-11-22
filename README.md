# FixMate Server — API Gateway & Backend

> **Platform:** FixMate — Smart Device & Home Appliance Repair Service Platform  
> **Course/Assignment:** Assignment 9 (Category 006)  
> **Architecture:** Node.js (ES Modules), Express 5, MongoDB Native Driver, Stripe SDK, HS256 JWT RBAC

---

## 1. Project Overview & Purpose

**FixMate Server** is the core RESTful backend API and database orchestration service powering the FixMate platform. It provides a secure, role-restricted ecosystem connecting customers needing repairs for consumer electronics and household appliances with certified professional technicians, backed by comprehensive administrative auditing and automated Stripe payment settlements.

### Key Capabilities
- **Multi-Role RBAC:** Dedicated authorization guards for `customer`, `technician`, and `admin` roles.
- **Service Catalog Lifecycle:** Full support for 7 appliance/device categories with technician submission, dynamic search, price sorting, availability toggles, and administrative approval workflow.
- **State-Machine Booking Management:** Strict status transitions (`requested` &rarr; `accepted` &rarr; `in-progress` &rarr; `completed`), active duplicate booking prevention, and atomic condition-matching database updates.
- **Stripe Payment Gateway:** Secure USD hosted checkout session creation, verified customer ownership, idempotent payment settlement, and asynchronous raw-buffer Stripe webhook listeners.
- **Platform Analytics:** Real-time business metrics including monthly revenue progression, booking breakdowns, and user demographics.

---

## 2. Deployment URLs & Admin Credentials

| Target | URL / Value |
| :--- | :--- |
| **Live Server API Base URL** | [https://fixmate-server-dk6f.onrender.com](https://fixmate-server-dk6f.onrender.com) |
| **Live Client (Frontend) URL** | [https://fixmatebd.vercel.app](https://fixmatebd.vercel.app) |
| **Local API Base URL** | `http://localhost:5000` |

### Default Admin & Evaluation Credentials (Test Accounts)
For instructor evaluation and platform administration:

- **Admin Account:**
  - **Email:** `admin@fixmate.com`
  - **Password:** `Admin@12345` *(or created via client sign-up and verified in `user` collection)*
  - **Role:** `admin`
- **Technician Account (Smartphone & Electronics):**
  - **Email:** `tech.smart@fixmate.com`
  - **Role:** `technician`
- **Technician Account (Home Appliances & Cooling):**
  - **Email:** `tech.appliance@fixmate.com`
  - **Role:** `technician`
- **Customer Account:**
  - **Email:** `customer@fixmate.com`
  - **Role:** `customer`

---

## 3. Technology Stack & Packages

### Runtime & Core Framework
- **Node.js** (v18+ or v20+ recommended, ES Modules enabled via `"type": "module"`)
- **Express.js v5.0.1:** Modern HTTP router handling JSON payloads and raw webhook buffers.

### Production Dependencies (`dependencies`)
| Package | Version | Purpose |
| :--- | :--- | :--- |
| `express` | `^5.0.1` | Web framework, route orchestration, and middleware execution. |
| `mongodb` | `^6.13.0` | Official MongoDB Node.js driver for native connection pooling and indexing. |
| `stripe` | `^17.6.0` | Official Stripe SDK for Checkout sessions, Payment Intents, and Webhooks. |
| `jsonwebtoken` | `^9.0.3` | Pinned `HS256` token verification with mandatory expiration (`exp`) enforcement. |
| `cors` | `^2.8.5` | Cross-Origin Resource Sharing configuration with credentials support. |
| `dotenv` | `^16.4.7` | Loads configuration environment variables from `.env`. |

### Development Dependencies (`devDependencies`)
| Package | Version | Purpose |
| :--- | :--- | :--- |
| `nodemon` | `^3.1.9` | Auto-restarts development server upon source code changes. |

---

## 4. Environment Variables Configuration

Create a `.env` file in the root of `fixmate-server` based on `.env.example`:

```bash
# Server Port
PORT=5000

# Client Application URL (For CORS whitelist and Stripe redirection)
CLIENT_URL=http://localhost:3000

# MongoDB Connection String (Atlas Cluster URI)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority

# JWT Signing Secret (Must be a secure random string, min 256 bits)
JWT_SECRET=your_jwt_secret_key_minimum_256_bits_long

# Stripe API Keys (USD payments)
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 5. Local Setup, Seeding & Execution Guide

### 5.1 Installation
Clone the repository, navigate to `fixmate-server`, and install the dependencies:
```bash
cd fixmate-server
npm install
```

### 5.2 Database Seeding
Populate your MongoDB database with initial sample data matching the Assignment 9 specification (7 categories, mock users, verified services, and bookings):
```bash
node seed.js
```
*Note: Seeding creates indices for payment sessions, clears existing collections, and inserts clean demo data ready for evaluation.*

### 5.3 Running the Server
- **Development Mode (with auto-reload):**
  ```bash
  npm run dev
  ```
- **Production Mode:**
  ```bash
  npm start
  ```
Once started, test health status by navigating to:
```http
GET http://localhost:5000/
Response: "FixMate server is running smoothly!...."
```

---

## 6. Automated Testing (Smoke Test Suite)

FixMate Server comes with a standalone automated smoke test suite that validates the entire backend pipeline without external test runners:

```bash
npm run test:smoke
```

### Covered Test Cases (24 Automated Checks):
1. **Server Health:** `GET /` verifies 200 OK.
2. **Catalog Integrity & Filtering:** `GET /api/services` verifies approved services, category filters, `serviceMode` ('Home Visit' / 'Shop Drop-off'), price sorting, and safe regex search.
3. **Limit Handling:** Checks integer limit filtering for homepage components.
4. **JWT Security Guards:**
   - Missing token returns `401 Unauthorized`.
   - Token without `exp` claim is rejected with `401`.
   - Expired token is rejected with `401`.
5. **Role-Based Access Control (RBAC):**
   - Customer cannot access technician-only routes (`403 Forbidden`).
   - Technician cannot book services (`403 Forbidden`).
   - Non-admin cannot access administrative analytics or user management (`403 Forbidden`).
   - Admin self-demotion is strictly blocked (`400 Bad Request`).
6. **Booking Lifecycle & Duplicate Guards:**
   - Valid booking creation succeeds (`201 Created`).
   - Submitting a duplicate booking for the same service while one is active returns `409 Conflict`.
   - Phone format, future date, and min-20-character description validations pass.
   - Status pipeline transitions: `requested` &rarr; `accepted` &rarr; `in-progress` &rarr; `completed`.
   - Technician ownership check: Only assigned technician can update status.
   - Customer cancellation guard: Rejects cancellation if status is `accepted` (`400 Bad Request`).
7. **Payment Security:**
   - Checkout session rejected for unpaid non-completed bookings (`400 Bad Request`).
   - Checkout session rejected if attempted by another customer (`403 Forbidden`).
   - Checkout session rejected for already paid bookings (`400 Bad Request`).
8. **Stripe Webhook Signature Verification:**
   - Missing or tampered `stripe-signature` header returns `400 Bad Request`.

---

## 7. License & Academic Integrity

This project is developed as part of **Assignment 9 (Category 006)**. All rights reserved by the author. Intended solely for academic evaluation and demonstration.
