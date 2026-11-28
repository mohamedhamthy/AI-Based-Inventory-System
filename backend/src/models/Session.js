import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    csrfToken: { type: String, required: true, select: false },
    lastActivity: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

const Session = mongoose.model("Session", sessionSchema);
export default Session;
