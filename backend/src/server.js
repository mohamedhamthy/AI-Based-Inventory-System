import connectDB from './config/db.js';
import { env } from './config/env.js';
import app from './app.js';

let server;

const startServer = async () => {
  await connectDB();
  server = app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
};

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});
