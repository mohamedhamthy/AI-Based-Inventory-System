import AppError from '../utils/AppError.js';
import { env } from '../config/env.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export const preventDemoWrites = (req, res, next) => {
  const isDemoUser = req.user?.role === 'demo' || req.user?.accountType === 'demo_user';
  if (isDemoUser && !safeMethods.has(req.method)) {
    return next(new AppError('Demo accounts have read-only access', 403));
  }
  next();
};

export const requireTrustedOrigin = (req, res, next) => {
  const origin = req.get('origin');
  if (!origin || !env.allowedOrigins.includes(origin)) {
    return next(new AppError('Request origin is not allowed', 403));
  }
  next();
};

export const verifyCsrfToken = (req, res, next) => {
  if (safeMethods.has(req.method)) return next();

  const origin = req.get('origin');
  if (!origin || !env.allowedOrigins.includes(origin)) {
    return next(new AppError('Request origin is not allowed', 403));
  }

  if (req.cookies?.inventory_session && req.get('x-csrf-token') !== req.authSession?.csrfToken) {
    return next(new AppError('Invalid or missing CSRF token', 403));
  }

  next();
};
