const path = require('path');
const dotenv = require('dotenv');
const { resolvePrefixedEnv } = require('../../../shared/moduleEnv');

dotenv.config({
  path: path.resolve(__dirname, '..', '..', '..', '..', '.env'),
});

dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
});

const sourceEnv = resolvePrefixedEnv('PM2');
const corsOrigin = sourceEnv.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? '*';
const corsOrigins = corsOrigin
  .split(',')
  .map((origin) => origin.trim().toLowerCase())
  .filter(Boolean);

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const env = {
  ...sourceEnv,
  PORT: Number(sourceEnv.PORT ?? process.env.PORT ?? 9091),
  CORS_ORIGIN: corsOrigin,
  CORS_ORIGINS: corsOrigins,
  CORS_ALLOW_ALL: corsOrigins.includes('*'),
  UPDATE_BRANCH: sourceEnv.UPDATE_BRANCH || 'master',
  WS_INTERVAL_MS: toPositiveInteger(sourceEnv.WS_INTERVAL_MS, 5000),
  WS_HISTORY_LIMIT: toPositiveInteger(sourceEnv.WS_HISTORY_LIMIT, 12),
};

module.exports = {
  env,
};
