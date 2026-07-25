import connectDB from './config/db.js';
import { env } from './config/env.js';
import app from './app.js';

connectDB();

const server = app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  server.close(() => process.exit(1));
});
