import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export const client = new MongoClient(uri);

// Database connect function
export async function connectDB() {
  await client.connect();
  console.log("MongoDB Atlas connected successfully!");
}