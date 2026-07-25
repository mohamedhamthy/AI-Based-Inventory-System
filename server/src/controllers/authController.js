import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { env } from '../config/env.js';

const signToken = (id) => jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    return next(new AppError('User already exists', 400));
  }

  const user = await User.create({ name, email, password, role: role || 'employee' });
  const token = signToken(user._id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token,
    data: { user: user.toSafeObject() },
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

  const token = signToken(user._id);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    data: { user: user.toSafeObject() },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: req.user } });
});

export const logout = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});
