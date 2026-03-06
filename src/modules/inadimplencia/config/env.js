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

const env = {
  ...sourceEnv,
  CORS_ORIGIN: corsOrigin,
  CORS_ORIGINS: corsOrigins,
  CORS_ALLOW_ALL: corsOrigins.includes('*'),
};

module.exports = {
  env,
};
