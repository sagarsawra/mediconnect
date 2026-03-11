const mongoose = require("mongoose");

/**
 * Connect to MongoDB with retry logic
 */
const connectDB = async () => {
  const MAX_RETRIES = 5;
  let retries = 0;

  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not defined in environment variables.");
    process.exit(1);
  }

  while (retries < MAX_RETRIES) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        maxPoolSize: 10, // Connection pool for performance
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await mongoose.connection.close();
        console.log("MongoDB connection closed due to app termination.");
        process.exit(0);
      });

      return;
    } catch (error) {
      retries++;
      console.error(
        `❌ MongoDB connection attempt ${retries} failed: ${error.message}`
      );

      if (retries >= MAX_RETRIES) {
        console.error("Max retries reached. Exiting.");
        process.exit(1);
      }

      // Exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * retries));
    }
  }
};

module.exports = connectDB;