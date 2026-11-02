import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { env } from '../config/env.js';
import Workspace from '../models/Workspace.js';
import Session from '../models/Session.js';
import crypto from 'node:crypto';

const SESSION_LIFETIME_MS = 4 * 60 * 60 * 1000;
const SESSION_COOKIE = 'inventory_session';
const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
  path: '/api',
};

const issueSession = async (user, res) => {
  if (user.role === 'demo') {
    const now = new Date();
    const activeSessions = await Session.find({
      user: user._id,
      expiresAt: { $gt: now },
      lastActivity: { $gt: new Date(now.getTime() - 30 * 60 * 1000) },
    }).sort({ createdAt: -1 }).select('_id').lean();
    const sessionsToRevoke = activeSessions.slice(9).map((session) => session._id);
    if (sessionsToRevoke.length) await Session.deleteMany({ _id: { $in: sessionsToRevoke } });
  }

  const now = new Date();
  const session = await Session.create({
    user: user._id,
    csrfToken: crypto.randomBytes(32).toString('hex'),
    lastActivity: now,
    expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
  });
  const token = jwt.sign({ id: user._id, sid: session._id }, env.jwtSecret, { expiresIn: '4h' });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_LIFETIME_MS });
  return session;
};

export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    return next(new AppError('User already exists', 400));
  }

  const user = await User.create({ name, email, password, role: 'employee' });
  await Workspace.create({
    name: `${name.trim()}'s workspace`,
    owner: user._id,
    members: [user._id],
  });
  const session = await issueSession(user, res);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: { user: user.toSafeObject(), csrfToken: session.csrfToken },
  });
});

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Invalid email or password', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Account is inactive', 401));
  }

  user.lastLogin = new Date();
  await user.save();

  const session = await issueSession(user, res);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user: user.toSafeObject(), csrfToken: session.csrfToken },
  });
});

export const demoLogin = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ role: 'demo', accountType: 'demo_user', isActive: true });
  if (!user) return next(new AppError('Demo access is temporarily unavailable', 503));

  const session = await issueSession(user, res);
  res.status(200).json({
    success: true,
    message: 'Demo session started',
    data: { user: user.toSafeObject(), csrfToken: session.csrfToken },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user, csrfToken: req.authSession.csrfToken },
  });
});

export const logout = asyncHandler(async (req, res) => {
  await Session.deleteOne({ _id: req.authSession._id });
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});
