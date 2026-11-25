import Workspace from '../models/Workspace.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getWorkspaces = asyncHandler(async (req, res) => {
  const query = { members: req.user._id };
  const workspaces = await Workspace.find(query).sort({ createdAt: 1 });
  res.status(200).json({ success: true, data: { workspaces } });
});
