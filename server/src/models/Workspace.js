import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    systemKey: { type: String, unique: true, sparse: true, select: false },
  },
  { timestamps: true },
);

const Workspace = mongoose.model('Workspace', workspaceSchema);
export default Workspace;
