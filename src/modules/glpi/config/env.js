const path = require('path');
const dotenv = require('dotenv');
const { resolvePrefixedEnv } = require('../../../shared/moduleEnv');

const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');

dotenv.config({
  path: path.resolve(projectRoot, '.env'),
});

dotenv.config({
  path: path.resolve(projectRoot, 'src/modules/glpi/.env'),
  override: true,
});

function normalizeBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value).trim().toLowerCase() === 'true';
}

function normalizePositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeOrigins(value) {
  return String(value ?? '')
    .split(',')
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean);
}

function buildEnv(source = process.env) {
  const sourceEnv = resolvePrefixedEnv('GLPI', source);
  const corsOrigin = sourceEnv.CORS_ORIGIN ?? sourceEnv.CORS_ORIGINS ?? '*';
  const corsOrigins = normalizeOrigins(corsOrigin);
  const missingRequired = [
    !sourceEnv.DB_HOST ? 'GLPI_DB_HOST' : '',
    !sourceEnv.DB_USER ? 'GLPI_DB_USER' : '',
    !sourceEnv.DB_PASSWORD ? 'GLPI_DB_PASSWORD' : '',
    !sourceEnv.DB_NAME ? 'GLPI_DB_NAME' : '',
  ].filter(Boolean);

  return {
    DB_HOST: sourceEnv.DB_HOST ?? '',
    DB_PORT: normalizePositiveInteger(sourceEnv.DB_PORT, 3306),
    DB_USER: sourceEnv.DB_USER ?? '',
    DB_PASSWORD: sourceEnv.DB_PASSWORD ?? '',
    DB_NAME: sourceEnv.DB_NAME ?? '',
    CORS_ORIGIN: corsOrigin,
    CORS_ORIGINS: corsOrigins,
    CORS_ALLOW_ALL: corsOrigins.includes('*'),
    QUERY_TIMEOUT_MS: normalizePositiveInteger(sourceEnv.QUERY_TIMEOUT_MS, 30000),
    ENABLED: normalizeBoolean(sourceEnv.ENABLED, true),
    missingRequired,
    isConfigured: missingRequired.length === 0,
  };
}

const env = buildEnv();

module.exports = {
  buildEnv,
  env,
};
