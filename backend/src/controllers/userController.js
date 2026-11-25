import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { createUserAccount, getUsersPage, updateUserAccount } from '../services/userService.js';

export const createUser = asyncHandler(async (req, res) => {
  const user = await createUserAccount({
    actor: req.user,
    workspaceId: req.workspaceId,
    ...req.body,
  });
  res.status(201).json({ success: true, message: 'Staff account created successfully', data: { user } });
});

export const getUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
  const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 10, 100));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role : '';
  const status = ['active', 'inactive'].includes(req.query.status) ? req.query.status : '';

  const data = await getUsersPage({
    page,
    limit,
    search,
    role,
    status,
    includeSuperAdmins: req.user.role === 'super_admin',
  });

  res.status(200).json({ success: true, message: 'Users retrieved successfully', data });
});

export const updateUser = asyncHandler(async (req, res) => {
  const changes = {};
  if (Object.hasOwn(req.body, 'role')) changes.role = req.body.role;
  if (Object.hasOwn(req.body, 'isActive')) changes.isActive = req.body.isActive;
  if (Object.keys(changes).length === 0) {
    throw new AppError('Provide a role or active status to update', 400);
  }

  const user = await updateUserAccount({ actor: req.user, userId: req.params.id, changes });
  res.status(200).json({ success: true, message: 'User updated successfully', data: { user } });
});
