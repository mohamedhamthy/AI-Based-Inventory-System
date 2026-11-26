import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

export const requireWorkspace = asyncHandler(async (req, res, next) => {
  const isDemoUser = req.user?.role === 'demo_viewer'
    || req.user?.role === 'demo'
    || req.user?.accountType === 'demo_user';
  if (isDemoUser) {
    const workspace = await Workspace.findOne({
      _id: env.demoWorkspaceId,
      members: req.user._id,
    }).lean();
    if (!workspace) {
      return next(new AppError('You do not have access to the configured demo workspace', 403));
    }
    req.workspaceId = workspace._id;
    return next();
  }

  const workspaceId = req.headers['x-workspace-id'];
  let workspace;

  if (typeof workspaceId === 'string' && mongoose.isValidObjectId(workspaceId)) {
    workspace = await Workspace.findOne({ _id: workspaceId, members: req.user._id }).lean();
  }

  if (!workspace) {
    workspace = await Workspace.findOne({ members: req.user._id }).sort({ createdAt: 1 }).lean();
  }

  if (!workspace) {
    return next(new AppError('You do not have access to any workspace', 403));
  }

  req.workspaceId = workspace._id;
  next();
});
