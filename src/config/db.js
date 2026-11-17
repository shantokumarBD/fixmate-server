import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export const client = new MongoClient(uri);

// Database instance
export const db = client.db("fixmate");

// Collections (BetterAuth & FixMate Core)
export const users = db.collection("user");
export const sessions = db.collection("session");
export const services = db.collection("services");
export const bookings = db.collection("bookings");
export const payments = db.collection("payments");

// Database connect function
export async function connectDB() {
  await client.connect();
  console.log("MongoDB Atlas connected successfully!");
}