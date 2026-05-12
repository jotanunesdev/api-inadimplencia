const path = require('path');
const { resolvePrefixedEnv } = require('../../../shared/moduleEnv');
const dotenv = require('dotenv');

const SERASA_UAT_DEFAULTS = Object.freeze({
  SERASA_AUTH_URL: 'https://uat-api.serasaexperian.com.br/security/iam/v1/client-identities/login',
  SERASA_DEBT_URL: 'https://api.serasa.dev/collection/debt/',
  SERASA_GUARANTOR_URL: 'https://api.serasa.dev/collection/debt/guarantor',
});

dotenv.config({
  path: path.resolve(__dirname, '..', '..', '..', '..', '.env'),
});

dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
});

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeString(value) {
  return isBlank(value) ? '' : String(value).trim();
}

function normalizeBoolean(value, fallback) {
  if (isBlank(value)) {
    return fallback;
  }

  return ['true', '1', 'sim', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizePositiveInteger(value, fallback) {
  if (isBlank(value)) {
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

function normalizeSerasaEnvironment(value) {
  const normalized = String(value ?? 'uat').trim().toLowerCase();

  if (['prod', 'producao', 'production'].includes(normalized)) {
    return 'production';
  }

  if (['hml', 'homolog', 'homologacao', 'sandbox', 'uat'].includes(normalized)) {
    return 'uat';
  }

  return normalized || 'uat';
}

function resolveSerasaUrl(sourceEnv, key, useUatDefaults) {
  if (!isBlank(sourceEnv[key])) {
    return String(sourceEnv[key]).trim();
  }

  return useUatDefaults ? SERASA_UAT_DEFAULTS[key] : '';
}

function buildSerasaMissingRequired(values) {
  const required = [
    ['INAD_SERASA_CLIENT_ID', values.SERASA_CLIENT_ID],
    ['INAD_SERASA_CLIENT_SECRET', values.SERASA_CLIENT_SECRET],
    ['INAD_SERASA_CREDITOR_DOCUMENT', values.SERASA_CREDITOR_DOCUMENT],
    ['INAD_SERASA_AREA_INFORMANTE', values.SERASA_AREA_INFORMANTE],
  ];

  if (!values.SERASA_USE_UAT_DEFAULTS) {
    required.push(
      ['INAD_SERASA_AUTH_URL', values.SERASA_AUTH_URL],
      ['INAD_SERASA_DEBT_URL', values.SERASA_DEBT_URL],
      ['INAD_SERASA_GUARANTOR_URL', values.SERASA_GUARANTOR_URL]
    );
  }

  return required
    .filter(([, value]) => isBlank(value))
    .map(([name]) => name);
}

function buildEnv(source = process.env) {
  const sourceEnv = resolvePrefixedEnv('INAD', source);
  const corsOrigin = source.CORS_ORIGIN ?? sourceEnv.CORS_ORIGIN ?? '*';
  const corsOrigins = normalizeOrigins(corsOrigin);

  // Notifications overdue scan interval (in milliseconds)
  // Default: 60000ms (60 seconds), minimum: 15000ms (15 seconds)
  const notificationsOverdueScanMs = parseInt(
    source.NOTIFICATIONS_OVERDUE_SCAN_MS ?? sourceEnv.NOTIFICATIONS_OVERDUE_SCAN_MS ?? '60000',
    10
  );
  const validatedScanMs = isNaN(notificationsOverdueScanMs) || notificationsOverdueScanMs < 15000
    ? 60000
    : notificationsOverdueScanMs;

  const serasaEnvironment = normalizeSerasaEnvironment(
    sourceEnv.SERASA_ENVIRONMENT ?? sourceEnv.SERASA_AMBIENTE
  );
  const serasaUatEnabled = normalizeBoolean(
    sourceEnv.SERASA_UAT_ENABLED,
    serasaEnvironment === 'uat'
  );
  const serasaUseUatDefaults = normalizeBoolean(
    sourceEnv.SERASA_USE_UAT_DEFAULTS,
    serasaUatEnabled
  );
  const serasaValues = {
    SERASA_ENVIRONMENT: serasaEnvironment,
    SERASA_UAT_ENABLED: serasaUatEnabled,
    SERASA_USE_UAT_DEFAULTS: serasaUseUatDefaults,
    SERASA_AUTH_URL: resolveSerasaUrl(sourceEnv, 'SERASA_AUTH_URL', serasaUseUatDefaults),
    SERASA_DEBT_URL: resolveSerasaUrl(sourceEnv, 'SERASA_DEBT_URL', serasaUseUatDefaults),
    SERASA_GUARANTOR_URL: resolveSerasaUrl(
      sourceEnv,
      'SERASA_GUARANTOR_URL',
      serasaUseUatDefaults
    ),
    SERASA_CLIENT_ID: normalizeString(sourceEnv.SERASA_CLIENT_ID),
    SERASA_CLIENT_SECRET: normalizeString(sourceEnv.SERASA_CLIENT_SECRET),
    SERASA_CREDITOR_DOCUMENT: normalizeString(sourceEnv.SERASA_CREDITOR_DOCUMENT),
    SERASA_AREA_INFORMANTE: normalizeString(sourceEnv.SERASA_AREA_INFORMANTE),
    SERASA_HTTP_TIMEOUT_MS: normalizePositiveInteger(
      sourceEnv.SERASA_HTTP_TIMEOUT_MS ?? sourceEnv.SERASA_TIMEOUT_MS,
      10000
    ),
  };
  const serasaMissingRequired = buildSerasaMissingRequired(serasaValues);

  return {
    ...sourceEnv,
    CORS_ORIGIN: corsOrigin,
    CORS_ORIGINS: corsOrigins,
    CORS_ALLOW_ALL: corsOrigins.includes('*'),
    NOTIFICATIONS_OVERDUE_SCAN_MS: validatedScanMs,
    ...serasaValues,
    SERASA_MISSING_REQUIRED: serasaMissingRequired,
    SERASA_IS_CONFIGURED: serasaMissingRequired.length === 0,
  };
}

const env = buildEnv();

module.exports = {
  buildEnv,
  env,
};
