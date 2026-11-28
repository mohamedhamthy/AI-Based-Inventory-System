import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { env } from "../config/env.js";
import Session from "../models/Session.js";
import { isDemoUser } from "../middleware/authMiddleware.js";

const SESSION_LIFETIME_MS = 4 * 60 * 60 * 1000;
const SESSION_COOKIE = "inventory_session";
const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: env.nodeEnv === "production" ? "none" : "lax",
  path: "/api",
};

const issueSession = async (user, res) => {
  const now = new Date();
  const session = await Session.create({
    user: user._id,
    csrfToken: crypto.randomBytes(32).toString("hex"),
    lastActivity: now,
    expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
  });
  const token = jwt.sign({ id: user._id, sid: session._id }, env.jwtSecret, {
    expiresIn: "4h",
  });
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions,
    maxAge: SESSION_LIFETIME_MS,
  });
  return session;
};

export const rejectPublicRegistration = (req, res, next) =>
  next(
    new AppError(
      "Public account registration is disabled. Contact an administrator.",
      403,
    ),
  );

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError("Invalid email or password", 401));
  }

  if (!user.isActive) {
    return next(new AppError("Account is inactive", 401));
  }

  if (!isDemoUser(user)) {
    user.lastLogin = new Date();
    await user.save();
  }

  const session = await issueSession(user, res);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: { user: user.toSafeObject(), csrfToken: session.csrfToken },
  });
});

export const demoLogin = asyncHandler(async (req, res, next) => {
  if (!env.demoMode) {
    return next(new AppError("Demo mode is not enabled on this server", 403));
  }

  const user = await User.findOne({
    email: env.demoAccountEmail,
    role: "demo_viewer",
    accountType: "demo_user",
    isActive: true,
  });
  if (!user) {
    return next(
      new AppError(
        "Demo account is not ready; restart the server after configuring its workspace",
        503,
      ),
    );
  }

  const session = await issueSession(user, res);
  res.set("Cache-Control", "no-store");
  res.status(200).json({
    success: true,
    message: "Entered read-only demo mode",
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
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

export const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  if (!user || !user.isActive) {
    return next(
      new AppError("The user belonging to this session no longer exists", 401),
    );
  }

  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return next(new AppError("Current password is incorrect", 400));
  }

  if (await user.comparePassword(newPassword)) {
    return next(
      new AppError("New password must be different from current password", 400),
    );
  }

  user.password = newPassword;
  await user.save();

  await Session.deleteMany({
    user: user._id,
    _id: { $ne: req.authSession._id },
  });

  res.status(200).json({
    success: true,
    message: "Password changed successfully.",
  });
});
