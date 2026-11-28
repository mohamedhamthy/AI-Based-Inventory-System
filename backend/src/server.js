import connectDB from "./config/db.js";
import { env } from "./config/env.js";
import app from "./app.js";
import { ensureDemoEnvironment } from "./config/demoEnvironment.js";

let server;

const startServer = async () => {
  await connectDB();
  await ensureDemoEnvironment();
  server = app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
};

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});
