import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
import stockMovementRoutes from './routes/stockMovementRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import marketPriceRoutes from './routes/marketPriceRoutes.js';
import AppError from './utils/AppError.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import userRoutes from './routes/userRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import { protect } from './middleware/authMiddleware.js';
import { requireWorkspace } from './middleware/workspaceMiddleware.js';
import { preventDemoWrites, verifyCsrfToken } from './middleware/demoAccessMiddleware.js';

const app = express();

app.set('trust proxy', env.trustProxy);
app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(cors({
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError('Request origin is not allowed', 403));
  },
  credentials: true,
}));

app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get('/health', (req, res) => res.json({ success: true, message: 'Server is healthy' }));
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, aiRoutes);
app.use('/api/products', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, productRoutes);
app.use('/api/categories', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, categoryRoutes);
app.use('/api/suppliers', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, supplierRoutes);
app.use('/api/dashboard', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, dashboardRoutes);
app.use('/api/reports', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, reportRoutes);
app.use('/api/sales', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, saleRoutes);
app.use('/api/customers', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, customerRoutes);
app.use('/api/stock-movements', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, stockMovementRoutes);
app.use('/api/purchase-orders', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, purchaseOrderRoutes);
app.use('/api/market-prices', protect, verifyCsrfToken, preventDemoWrites, requireWorkspace, marketPriceRoutes);

app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: err.message || 'Internal server error',
  };
  if (err.errorCode) response.code = err.errorCode;
  if (env.nodeEnv === 'development' && err.stack) response.stack = err.stack;
  if (err.details) response.details = err.details;
  res.status(statusCode).json(response);
});

export default app;
