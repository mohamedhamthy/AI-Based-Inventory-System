import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Not authorized to access this route', 401));
  }

  const decoded = jwt.verify(token, env.jwtSecret);
  const currentUser = await User.findById(decoded.id).select('-password');

  if (!currentUser || !currentUser.isActive) {
    return next(new AppError('The user belonging to this token no longer exists', 401));
  }

  req.user = currentUser;
  next();
});

export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};
