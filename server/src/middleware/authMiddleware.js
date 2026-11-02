import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import Session from '../models/Session.js';

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

  const now = new Date();
  if (now.getTime() - session.lastActivity.getTime() > 30 * 60 * 1000) {
    await Session.deleteOne({ _id: session._id });
    return next(new AppError('Your session expired due to inactivity', 401));
  }

  if (now.getTime() - session.lastActivity.getTime() > 60 * 1000) {
    session.lastActivity = now;
    await session.save();
  }

  const currentUser = await User.findById(decoded.id).select('-password');

  if (!currentUser || !currentUser.isActive) {
    return next(new AppError('The user belonging to this token no longer exists', 401));
  }

  if ((currentUser.role === 'demo') !== (currentUser.accountType === 'demo_user')) {
    return next(new AppError('This account is not permitted to access the application', 403));
  }

  req.user = currentUser;
  req.authSession = session;
  next();
});

export const authorizeRoles = (...roles) => (req, res, next) => {
  if (req.user.accountType === 'demo_user') {
    if (req.user.role !== 'demo' || !roles.includes('demo')) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    return next();
  }
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};
