require("dotenv").config();
const app = require("./app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

/**
 * Start the server after successful DB connection
 */
const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`\n🚀 MediConnect API Server`);
      console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
      console.log(`   Port        : ${PORT}`);
      console.log(`   URL         : http://localhost:${PORT}`);
      console.log(`   Health      : http://localhost:${PORT}/health\n`);
    });

    // Graceful shutdown handlers
    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Unhandled rejection guard
    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      server.close(() => process.exit(1));
    });

  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
