import path from 'path';
import dotenv from 'dotenv';
import {
  GRAPH_DEFAULT_BASE_URL,
  GRAPH_DEFAULT_PHOTO_CONCURRENCY,
  GRAPH_DEFAULT_SCOPE,
  GRAPH_DEFAULT_TIMEOUT_MS,
  GRAPH_DEFAULT_TOKEN_BUFFER_MS,
} from './graph';
import type { M365Env } from '../types/env';

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
  path: path.resolve(projectRoot, 'src/modules/m365/.env'),
});

function toPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase();
}

const sourceEnv = resolvePrefixedEnv('M365');
const corsOrigin = sourceEnv.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? '*';
const corsOrigins = corsOrigin
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const azureTenantId = sourceEnv.AZURE_TENANT_ID ?? process.env.AZURE_TENANT_ID ?? '';
const azureClientId = sourceEnv.AZURE_CLIENT_ID ?? process.env.AZURE_CLIENT_ID ?? '';
const azureClientSecret =
  sourceEnv.AZURE_CLIENT_SECRET ?? process.env.AZURE_CLIENT_SECRET ?? '';

const missingRequired = [
  !azureTenantId ? 'AZURE_TENANT_ID' : '',
  !azureClientId ? 'AZURE_CLIENT_ID' : '',
  !azureClientSecret ? 'AZURE_CLIENT_SECRET' : '',
].filter(Boolean);

export const env: M365Env = {
  PORT: Number(sourceEnv.PORT ?? process.env.PORT ?? 3011),
  CORS_ORIGIN: corsOrigin,
  CORS_ORIGINS: corsOrigins,
  CORS_ALLOW_ALL: corsOrigins.includes('*'),
  AZURE_TENANT_ID: azureTenantId,
  AZURE_CLIENT_ID: azureClientId,
  AZURE_CLIENT_SECRET: azureClientSecret,
  GRAPH_BASE_URL: sourceEnv.GRAPH_BASE_URL ?? process.env.GRAPH_BASE_URL ?? GRAPH_DEFAULT_BASE_URL,
  GRAPH_SCOPE: sourceEnv.GRAPH_SCOPE ?? process.env.GRAPH_SCOPE ?? GRAPH_DEFAULT_SCOPE,
  HTTP_TIMEOUT_MS: toPositiveInteger(
    sourceEnv.HTTP_TIMEOUT_MS ?? process.env.HTTP_TIMEOUT_MS,
    GRAPH_DEFAULT_TIMEOUT_MS
  ),
  PHOTO_CONCURRENCY_LIMIT: toPositiveInteger(
    sourceEnv.PHOTO_CONCURRENCY_LIMIT ?? process.env.PHOTO_CONCURRENCY_LIMIT,
    GRAPH_DEFAULT_PHOTO_CONCURRENCY
  ),
  TOKEN_CACHE_BUFFER_MS: toPositiveInteger(
    sourceEnv.TOKEN_CACHE_BUFFER_MS ?? process.env.TOKEN_CACHE_BUFFER_MS,
    GRAPH_DEFAULT_TOKEN_BUFFER_MS
  ),
  missingRequired,
  isConfigured: missingRequired.length === 0,
};

export function buildMissingConfigMessage(): string {
  if (env.missingRequired.length === 0) {
    return 'Modulo M365 configurado.';
  }

  return `Modulo M365 nao configurado. Variaveis ausentes: ${env.missingRequired.join(
    ', '
  )}.`;
}
