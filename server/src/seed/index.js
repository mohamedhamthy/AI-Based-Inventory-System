import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { ensureDemoEnvironment } from '../config/demoEnvironment.js';

dotenv.config();

const seedDemo = async () => {
  await connectDB();
  await ensureDemoEnvironment();
  console.log('Isolated demo data is ready.');
  await mongoose.disconnect();
};

seedDemo().catch(async (error) => {
  console.error('Demo data setup failed:', error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
