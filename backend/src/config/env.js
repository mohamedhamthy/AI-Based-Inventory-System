import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = ['PORT', 'MONGODB_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'CLIENT_URL'];
const trustProxySetting = process.env.TRUST_PROXY || '0';
const trustProxy = trustProxySetting === 'true'
  ? true
  : trustProxySetting === 'false'
    ? false
    : Number(trustProxySetting);

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

if (typeof trustProxy !== 'boolean' && (!Number.isInteger(trustProxy) || trustProxy < 0)) {
  throw new Error('TRUST_PROXY must be true, false, or a non-negative proxy hop count');
}

if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('replace-with')) {
  throw new Error('JWT_SECRET must be a private random value with at least 32 characters');
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  allowedOrigins: process.env.CLIENT_URL.split(',').map((url) => url.trim()).filter(Boolean),
  trustProxy,
};
