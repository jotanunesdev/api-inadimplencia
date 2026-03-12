import path from 'path';
import dotenv from 'dotenv';
import type { EntradaNotaFiscalEnv } from '../types/env';

const { resolvePrefixedEnv } = require('../../../shared/moduleEnv') as {
  resolvePrefixedEnv: (
    prefix: string,
    source?: NodeJS.ProcessEnv
  ) => Record<string, string | undefined>;
};

dotenv.config({
  path: path.resolve(__dirname, '..', '..', '..', '..', '.env'),
});

dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
});

function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase();
}

function toOptionalPositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

function parseServerAndInstance(rawValue: string): { server: string; instance?: string } {
  const normalized = rawValue.trim();
  const [server, instance] = normalized.split('\\');

  return {
    server: server?.trim() ?? '',
    instance: instance?.trim() || undefined,
  };
}

const sourceEnv = resolvePrefixedEnv('ENF');
const corsOrigin = sourceEnv.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? '*';
const corsOrigins = corsOrigin
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const parsedServer = parseServerAndInstance(
  sourceEnv.DB_SERVER ?? process.env.ENF_DB_SERVER ?? process.env.DB_SERVER ?? ''
);
const database = sourceEnv.DB_DATABASE ?? process.env.ENF_DB_DATABASE ?? '';
const user = sourceEnv.DB_USER ?? process.env.ENF_DB_USER ?? '';
const password = sourceEnv.DB_PASSWORD ?? process.env.ENF_DB_PASSWORD ?? '';

const missingRequired = [
  !parsedServer.server ? 'ENF_DB_SERVER' : '',
  !database ? 'ENF_DB_DATABASE' : '',
  !user ? 'ENF_DB_USER' : '',
  !password ? 'ENF_DB_PASSWORD' : '',
].filter(Boolean);

export const env: EntradaNotaFiscalEnv = {
  PORT: Number(sourceEnv.PORT ?? process.env.PORT ?? 3015),
  CORS_ORIGIN: corsOrigin,
  CORS_ORIGINS: corsOrigins,
  CORS_ALLOW_ALL: corsOrigins.includes('*'),
  DB_SERVER: parsedServer.server,
  DB_INSTANCE: sourceEnv.DB_INSTANCE ?? process.env.ENF_DB_INSTANCE ?? parsedServer.instance,
  DB_DATABASE: database,
  DB_USER: user,
  DB_PASSWORD: password,
  DB_PORT: toOptionalPositiveInteger(
    sourceEnv.DB_PORT ?? process.env.ENF_DB_PORT ?? process.env.DB_PORT
  ),
  DB_SCHEMA: sourceEnv.DB_SCHEMA ?? process.env.ENF_DB_SCHEMA ?? 'dbo',
  DB_ENCRYPT: toBoolean(sourceEnv.DB_ENCRYPT ?? process.env.ENF_DB_ENCRYPT, false),
  DB_TRUST_CERT: toBoolean(
    sourceEnv.DB_TRUST_CERT ?? process.env.ENF_DB_TRUST_CERT,
    true
  ),
  TABLE_PREFIX:
    sourceEnv.TABLE_PREFIX ?? process.env.ENF_TABLE_PREFIX ?? 'entrada_nota_fiscal',
  missingRequired,
  isConfigured: missingRequired.length === 0,
};

export function buildMissingConfigMessage(): string {
  if (env.missingRequired.length === 0) {
    return 'Modulo Entrada de Nota Fiscal configurado.';
  }

  return `Modulo Entrada de Nota Fiscal nao configurado. Variaveis ausentes: ${env.missingRequired.join(
    ', '
  )}.`;
}
