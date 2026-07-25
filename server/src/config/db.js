import mongoose from 'mongoose';
import { env } from './env.js';

const connectDB = async () => {
  try {
    await mongoose.connect(env.mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.log('Retrying MongoDB connection in 5 seconds...');
    setTimeout(() => {
      connectDB().catch(() => {});
    }, 5000);
  }
};

export default connectDB;
