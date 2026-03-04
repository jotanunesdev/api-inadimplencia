const { resolvePrefixedEnv } = require('../../../shared/moduleEnv');
const dotenv = require('dotenv');

dotenv.config();

const sourceEnv = resolvePrefixedEnv('INAD');
const corsOrigin = sourceEnv.CORS_ORIGIN ?? '*';
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
