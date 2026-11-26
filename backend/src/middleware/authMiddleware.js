import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import Session from '../models/Session.js';
import { hasPermission } from '../constants/permissions.js';

export const isDemoUser = (user) => (
  user?.role === 'demo_viewer' || user?.role === 'demo' || user?.accountType === 'demo_user'
);

export const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.inventory_session
    || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!token) {
    return next(new AppError('Not authorized to access this route', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    return next(new AppError('Your session is invalid or has expired', 401));
  }

  if (!decoded.sid) return next(new AppError('Your session is invalid or has expired', 401));

  const session = await Session.findOne({ _id: decoded.sid, user: decoded.id, expiresAt: { $gt: new Date() } }).select('+csrfToken');
  if (!session) return next(new AppError('Your session is invalid or has expired', 401));

  const currentUser = await User.findById(decoded.id).select('-password');
  if (!currentUser || !currentUser.isActive) {
    return next(new AppError('The user belonging to this token no longer exists', 401));
  }

  const now = new Date();
  if (now.getTime() - session.lastActivity.getTime() > 30 * 60 * 1000) {
    await Session.deleteOne({ _id: session._id });
    return next(new AppError('Your session expired due to inactivity', 401));
  }

  if (!isDemoUser(currentUser) && now.getTime() - session.lastActivity.getTime() > 60 * 1000) {
    session.lastActivity = now;
    await session.save();
  }

  req.user = currentUser;
  req.authSession = session;
  next();
});

export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};

export const authorizePermissions = (...permissions) => (req, res, next) => {
  if (!permissions.every((permission) => hasPermission(req.user.role, permission))) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};
