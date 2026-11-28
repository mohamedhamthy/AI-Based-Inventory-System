import mongoose from "mongoose";

const bootstrapStateSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    state: {
      type: String,
      enum: ["initializing", "completed"],
      required: true,
    },
    token: { type: String, required: true },
    claimedAt: { type: Date, required: true },
    hostname: { type: String, required: true },
    processId: { type: Number, required: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const BootstrapState = mongoose.model("BootstrapState", bootstrapStateSchema);
export default BootstrapState;
