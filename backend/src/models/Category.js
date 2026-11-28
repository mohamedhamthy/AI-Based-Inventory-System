import mongoose from "mongoose";
import {
  addSampleDataIndex,
  sampleDataFields,
} from "../utils/sampleDataFields.js";

const categorySchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      immutable: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    icon: { type: String, default: "📦" },
    color: { type: String, default: "#22d3ee" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    testSuite: {
      type: String,
      enum: ["synthetic", "integration"],
      immutable: true,
    },
    testRunId: { type: String, trim: true, immutable: true },
    ...sampleDataFields(),
  },
  { timestamps: true },
);

categorySchema.index({ name: 1, createdAt: -1 });
categorySchema.index({ workspaceId: 1, name: 1 }, { unique: true });
categorySchema.index({ workspaceId: 1, code: 1 }, { unique: true });
addSampleDataIndex(categorySchema);

const Category = mongoose.model("Category", categorySchema);
export default Category;
