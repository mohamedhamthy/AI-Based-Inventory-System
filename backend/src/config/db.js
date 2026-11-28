import mongoose from "mongoose";
import { env } from "./env.js";
import {
  migrateLegacyWorkspaces,
  migrateWorkspaceIndexes,
} from "./workspaceMigration.js";
import Sale from "../models/Sale.js";
import StockMovement from "../models/StockMovement.js";
import PurchaseOrder from "../models/PurchaseOrder.js";

const connectDB = async () => {
  try {
    await mongoose.connect(env.mongoUri, {
      autoIndex: !env.demoMode,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 20,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 5000,
    });
    if (!env.demoMode) {
      await Promise.all([
        Sale.init(),
        StockMovement.init(),
        PurchaseOrder.init(),
      ]);
      await migrateLegacyWorkspaces();
      await migrateWorkspaceIndexes();
    }
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export default connectDB;
