"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.buildMissingConfigMessage = buildMissingConfigMessage;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const { resolvePrefixedEnv } = require('../../../shared/moduleEnv');
const projectRoot = path_1.default.resolve(__dirname, '..', '..', '..', '..');
dotenv_1.default.config({
    path: path_1.default.resolve(projectRoot, '.env'),
});
dotenv_1.default.config({
    path: path_1.default.resolve(projectRoot, 'src/modules/entrada-nota-fiscal/.env'),
});
function normalizeOrigin(origin) {
    return origin.trim().toLowerCase();
}
function toOptionalPositiveInteger(value) {
    if (!value) {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return undefined;
    }
    return parsed;
}
function toBoolean(value, fallback) {
    if (!value) {
        return fallback;
    }
    return value.trim().toLowerCase() === 'true';
}
function parseServerAndInstance(rawValue) {
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
const parsedServer = parseServerAndInstance(sourceEnv.DB_SERVER ?? process.env.ENF_DB_SERVER ?? process.env.DB_SERVER ?? '');
const database = sourceEnv.DB_DATABASE ?? process.env.ENF_DB_DATABASE ?? '';
const user = sourceEnv.DB_USER ?? process.env.ENF_DB_USER ?? '';
const password = sourceEnv.DB_PASSWORD ?? process.env.ENF_DB_PASSWORD ?? '';
const missingRequired = [
    !parsedServer.server ? 'ENF_DB_SERVER' : '',
    !database ? 'ENF_DB_DATABASE' : '',
    !user ? 'ENF_DB_USER' : '',
    !password ? 'ENF_DB_PASSWORD' : '',
].filter(Boolean);
exports.env = {
    PORT: Number(sourceEnv.PORT ?? process.env.PORT ?? 3015),
    CORS_ORIGIN: corsOrigin,
    CORS_ORIGINS: corsOrigins,
    CORS_ALLOW_ALL: corsOrigins.includes('*'),
    DB_SERVER: parsedServer.server,
    DB_INSTANCE: sourceEnv.DB_INSTANCE ?? process.env.ENF_DB_INSTANCE ?? parsedServer.instance,
    DB_DATABASE: database,
    DB_USER: user,
    DB_PASSWORD: password,
    DB_PORT: toOptionalPositiveInteger(sourceEnv.DB_PORT ?? process.env.ENF_DB_PORT ?? process.env.DB_PORT),
    DB_SCHEMA: sourceEnv.DB_SCHEMA ?? process.env.ENF_DB_SCHEMA ?? 'dbo',
    DB_ENCRYPT: toBoolean(sourceEnv.DB_ENCRYPT ?? process.env.ENF_DB_ENCRYPT, false),
    DB_TRUST_CERT: toBoolean(sourceEnv.DB_TRUST_CERT ?? process.env.ENF_DB_TRUST_CERT, true),
    TABLE_PREFIX: sourceEnv.TABLE_PREFIX ?? process.env.ENF_TABLE_PREFIX ?? 'entrada_nota_fiscal',
    missingRequired,
    isConfigured: missingRequired.length === 0,
};
function buildMissingConfigMessage() {
    if (exports.env.missingRequired.length === 0) {
        return 'Modulo Entrada de Nota Fiscal configurado.';
    }
    return `Modulo Entrada de Nota Fiscal nao configurado. Variaveis ausentes: ${exports.env.missingRequired.join(', ')}.`;
}
