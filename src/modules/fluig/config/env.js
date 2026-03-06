const path = require('path');
const { resolvePrefixedEnv } = require('../../../shared/moduleEnv');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
});

const sourceEnv = resolvePrefixedEnv('FLUIG');

function requireEnv(name, fallback) {
  const value = sourceEnv[name] ?? fallback;

  if (value === undefined || value === '') {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const env = {
  PORT: Number(sourceEnv.PORT ?? 3002),
  SMTP_HOST: requireEnv('SMTP_HOST'),
  SMTP_PORT: Number(sourceEnv.SMTP_PORT ?? 587),
  SMTP_USER: requireEnv('SMTP_USER'),
  SMTP_PASS: requireEnv('SMTP_PASS'),
  MAIL_FROM: sourceEnv.MAIL_FROM || sourceEnv.SMTP_USER,
  MAIL_TO: requireEnv('MAIL_TO'),
};

module.exports = {
  env,
};
