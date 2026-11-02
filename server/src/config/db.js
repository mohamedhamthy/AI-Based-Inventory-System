import mongoose from 'mongoose';
import { env } from './env.js';
import { migrateLegacyWorkspaces, migrateWorkspaceIndexes } from './workspaceMigration.js';

const connectDB = async () => {
  try {
    await mongoose.connect(env.mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    await migrateLegacyWorkspaces();
    await migrateWorkspaceIndexes();
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
};

export default connectDB;
