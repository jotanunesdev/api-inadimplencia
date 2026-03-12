import path from 'path';
import dotenv from 'dotenv';
import type { AuthEnv } from '../types/env';

const { resolvePrefixedEnv } = require('../../../shared/moduleEnv') as {
  resolvePrefixedEnv: (
    prefix: string,
    source?: NodeJS.ProcessEnv
  ) => Record<string, string | undefined>;
};

const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');

dotenv.config({
  path: path.resolve(projectRoot, '.env'),
});

dotenv.config({
  path: path.resolve(projectRoot, 'src/modules/auth/.env'),
});

function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase();
}

const sourceEnv = resolvePrefixedEnv('AUTH');
const corsOrigin = sourceEnv.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? '*';
const corsOrigins = corsOrigin
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const ldapUrl = sourceEnv.LDAP_URL ?? process.env.AUTH_LDAP_URL ?? '';
const ldapBaseDn = sourceEnv.LDAP_BASE_DN ?? process.env.AUTH_LDAP_BASE_DN ?? '';
const ldapBindUser = sourceEnv.LDAP_BIND_USER ?? process.env.AUTH_LDAP_BIND_USER ?? '';
const ldapBindPassword =
  sourceEnv.LDAP_BIND_PASSWORD ?? process.env.AUTH_LDAP_BIND_PASSWORD ?? '';
const jwtSecret = sourceEnv.JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? '';

const missingRequired = [
  !ldapUrl ? 'AUTH_LDAP_URL' : '',
  !ldapBaseDn ? 'AUTH_LDAP_BASE_DN' : '',
  !ldapBindUser ? 'AUTH_LDAP_BIND_USER' : '',
  !ldapBindPassword ? 'AUTH_LDAP_BIND_PASSWORD' : '',
  !jwtSecret ? 'AUTH_JWT_SECRET' : '',
].filter(Boolean);

export const env: AuthEnv = {
  PORT: Number(sourceEnv.PORT ?? process.env.PORT ?? 3013),
  CORS_ORIGIN: corsOrigin,
  CORS_ORIGINS: corsOrigins,
  CORS_ALLOW_ALL: corsOrigins.includes('*'),
  LDAP_URL: ldapUrl,
  LDAP_BASE_DN: ldapBaseDn,
  LDAP_USERS_OU: sourceEnv.LDAP_USERS_OU ?? process.env.AUTH_LDAP_USERS_OU,
  LDAP_BIND_USER: ldapBindUser,
  LDAP_BIND_PASSWORD: ldapBindPassword,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: sourceEnv.JWT_EXPIRES_IN ?? process.env.AUTH_JWT_EXPIRES_IN ?? '8h',
  missingRequired,
  isConfigured: missingRequired.length === 0,
};

export function buildMissingConfigMessage(): string {
  if (env.missingRequired.length === 0) {
    return 'Modulo Auth configurado.';
  }

  return `Modulo Auth nao configurado. Variaveis ausentes: ${env.missingRequired.join(
    ', '
  )}.`;
}
