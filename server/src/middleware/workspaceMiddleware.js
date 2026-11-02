import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const requireWorkspace = asyncHandler(async (req, res, next) => {
  const workspaceId = req.headers['x-workspace-id'];
  if (typeof workspaceId !== 'string' || !mongoose.isValidObjectId(workspaceId)) {
    return next(new AppError('Select a valid workspace to continue', 400));
  }

  const workspaceQuery = { _id: workspaceId, members: req.user._id };
  if (req.user.accountType === 'demo_user') {
    workspaceQuery.systemKey = 'demo';
  }
  const workspace = await Workspace.exists(workspaceQuery);
  if (!workspace) {
    return next(new AppError('You do not have access to this workspace', 403));
  }

  req.workspaceId = workspace._id;
  next();
});
