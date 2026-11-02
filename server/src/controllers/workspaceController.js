import Workspace from '../models/Workspace.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';

export const getWorkspaces = asyncHandler(async (req, res) => {
  const query = { members: req.user._id };
  if (req.user.accountType === 'demo_user') {
    query.systemKey = 'demo';
  }
  const workspaces = await Workspace.find(query).sort({ createdAt: 1 });
  res.status(200).json({ success: true, data: { workspaces } });
});

export const createWorkspace = asyncHandler(async (req, res, next) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 2 || name.length > 60) {
    return next(new AppError('Workspace name must be between 2 and 60 characters', 400));
  }

  const workspace = await Workspace.create({
    name,
    owner: req.user._id,
    members: [req.user._id],
  });
  res.status(201).json({ success: true, message: 'Workspace created successfully', data: { workspace } });
});
