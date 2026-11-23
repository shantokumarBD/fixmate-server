import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export const client = new MongoClient(uri);

// Database instance
export const db = client.db("fixmate");

// Shared Collection Name Constants (Exactly 4 collections as per Assignment 9 PDF)
export const USER_COLLECTION = "user";
export const SERVICE_COLLECTION = "services";
export const BOOKING_COLLECTION = "bookings";
export const PAYMENT_COLLECTION = "payments";

// Collections (FixMate Core)
export const users = db.collection(USER_COLLECTION);
export const services = db.collection(SERVICE_COLLECTION);
export const bookings = db.collection(BOOKING_COLLECTION);
export const payments = db.collection(PAYMENT_COLLECTION);


export async function connectDB() {
  
  await client.connect();
  console.log("MongoDB Atlas connected successfully!");

  // Initialize unique index for Stripe Session 
  try {
    await payments.createIndex({ stripeSessionId: 1 }, { unique: true });
  } catch (err) {
    // ignore if index already exists
  }

  return db;
}