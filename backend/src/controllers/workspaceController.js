import Workspace from '../models/Workspace.js';
import asyncHandler from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

export const getWorkspaces = asyncHandler(async (req, res) => {
  const isDemoUser = req.user?.role === 'demo_viewer'
    || req.user?.role === 'demo'
    || req.user?.accountType === 'demo_user';
  const query = isDemoUser
    ? { _id: env.demoWorkspaceId, members: req.user._id }
    : { members: req.user._id };
  const workspaces = await Workspace.find(query).sort({ createdAt: 1 });
  res.status(200).json({ success: true, data: { workspaces } });
});
