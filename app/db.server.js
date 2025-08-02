import mongoose from 'mongoose';

const MONGODB_URI = process.env.DATABASE_URL;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the DATABASE_URL environment variable inside .env'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // if (cached.conn) {
  //   console.log("======Using cached MongoDB connection");
  //   return cached.conn;
  // }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    console.log("======Creating new MongoDB connection");

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    console.log("======Awaiting MongoDB connection promise");
    cached.conn = await cached.promise;
    console.log("======MongoDB connection established successfully");
  } catch (e) {
    console.error("======MongoDB connection error:", e);
    cached.promise = null;
    throw e;
  }

  console.log("======MongoDB connection ready state:", cached.conn.readyState);

  return cached.conn;
}

export default connectDB;
