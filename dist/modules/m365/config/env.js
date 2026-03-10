"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.buildMissingConfigMessage = buildMissingConfigMessage;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const graph_1 = require("./graph");
const { resolvePrefixedEnv } = require('../../../shared/moduleEnv');
dotenv_1.default.config({
    path: path_1.default.resolve(__dirname, '..', '..', '..', '..', '.env'),
});
dotenv_1.default.config({
    path: path_1.default.resolve(__dirname, '..', '.env'),
});
function toPositiveInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}
function normalizeOrigin(origin) {
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
const azureClientSecret = sourceEnv.AZURE_CLIENT_SECRET ?? process.env.AZURE_CLIENT_SECRET ?? '';
const missingRequired = [
    !azureTenantId ? 'AZURE_TENANT_ID' : '',
    !azureClientId ? 'AZURE_CLIENT_ID' : '',
    !azureClientSecret ? 'AZURE_CLIENT_SECRET' : '',
].filter(Boolean);
exports.env = {
    PORT: Number(sourceEnv.PORT ?? process.env.PORT ?? 3011),
    CORS_ORIGIN: corsOrigin,
    CORS_ORIGINS: corsOrigins,
    CORS_ALLOW_ALL: corsOrigins.includes('*'),
    AZURE_TENANT_ID: azureTenantId,
    AZURE_CLIENT_ID: azureClientId,
    AZURE_CLIENT_SECRET: azureClientSecret,
    GRAPH_BASE_URL: sourceEnv.GRAPH_BASE_URL ?? process.env.GRAPH_BASE_URL ?? graph_1.GRAPH_DEFAULT_BASE_URL,
    GRAPH_SCOPE: sourceEnv.GRAPH_SCOPE ?? process.env.GRAPH_SCOPE ?? graph_1.GRAPH_DEFAULT_SCOPE,
    HTTP_TIMEOUT_MS: toPositiveInteger(sourceEnv.HTTP_TIMEOUT_MS ?? process.env.HTTP_TIMEOUT_MS, graph_1.GRAPH_DEFAULT_TIMEOUT_MS),
    PHOTO_CONCURRENCY_LIMIT: toPositiveInteger(sourceEnv.PHOTO_CONCURRENCY_LIMIT ?? process.env.PHOTO_CONCURRENCY_LIMIT, graph_1.GRAPH_DEFAULT_PHOTO_CONCURRENCY),
    TOKEN_CACHE_BUFFER_MS: toPositiveInteger(sourceEnv.TOKEN_CACHE_BUFFER_MS ?? process.env.TOKEN_CACHE_BUFFER_MS, graph_1.GRAPH_DEFAULT_TOKEN_BUFFER_MS),
    missingRequired,
    isConfigured: missingRequired.length === 0,
};
function buildMissingConfigMessage() {
    if (exports.env.missingRequired.length === 0) {
        return 'Modulo M365 configurado.';
    }
    return `Modulo M365 nao configurado. Variaveis ausentes: ${exports.env.missingRequired.join(', ')}.`;
}
