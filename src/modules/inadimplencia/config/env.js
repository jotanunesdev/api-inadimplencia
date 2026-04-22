const path = require('path');
const { resolvePrefixedEnv } = require('../../../shared/moduleEnv');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '..', '..', '..', '..', '.env'),
});

dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
});

const sourceEnv = resolvePrefixedEnv('INAD');
const corsOrigin = process.env.CORS_ORIGIN ?? sourceEnv.CORS_ORIGIN ?? '*';
const corsOrigins = corsOrigin
  .split(',')
  .map((origin) => origin.trim().toLowerCase())
  .filter(Boolean);

// Notifications overdue scan interval (in milliseconds)
// Default: 60000ms (60 seconds), minimum: 15000ms (15 seconds)
const notificationsOverdueScanMs = parseInt(
  process.env.NOTIFICATIONS_OVERDUE_SCAN_MS ?? sourceEnv.NOTIFICATIONS_OVERDUE_SCAN_MS ?? '60000',
  10
);
const validatedScanMs = isNaN(notificationsOverdueScanMs) || notificationsOverdueScanMs < 15000
  ? 60000
  : notificationsOverdueScanMs;

const env = {
  ...sourceEnv,
  CORS_ORIGIN: corsOrigin,
  CORS_ORIGINS: corsOrigins,
  CORS_ALLOW_ALL: corsOrigins.includes('*'),
  NOTIFICATIONS_OVERDUE_SCAN_MS: validatedScanMs,
};

module.exports = {
  env,
};
