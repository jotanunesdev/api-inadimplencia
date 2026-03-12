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
dotenv_1.default.config({
    path: path_1.default.resolve(__dirname, '..', '..', '..', '..', '.env'),
});
dotenv_1.default.config({
    path: path_1.default.resolve(__dirname, '..', '.env'),
});
function normalizeOrigin(origin) {
    return origin.trim().toLowerCase();
}
function toBoolean(value, fallback) {
    if (!value) {
        return fallback;
    }
    return value.trim().toLowerCase() === 'true';
}
const sourceEnv = resolvePrefixedEnv('RM');
const corsOrigin = sourceEnv.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? '*';
const corsOrigins = corsOrigin
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
const readViewUrl = sourceEnv.READVIEW_URL ?? process.env.RM_READVIEW_URL ?? '';
const readViewUser = sourceEnv.READVIEW_USER ?? process.env.RM_READVIEW_USER ?? '';
const readViewPassword = sourceEnv.READVIEW_PASSWORD ?? process.env.RM_READVIEW_PASSWORD ?? '';
const readViewAction = sourceEnv.READVIEW_ACTION ?? process.env.RM_READVIEW_ACTION ?? '';
const readViewNamespace = sourceEnv.READVIEW_NAMESPACE ?? process.env.RM_READVIEW_NAMESPACE ?? '';
const missingRequired = [
    !readViewUrl ? 'RM_READVIEW_URL' : '',
    !readViewUser ? 'RM_READVIEW_USER' : '',
    !readViewPassword ? 'RM_READVIEW_PASSWORD' : '',
    !readViewAction ? 'RM_READVIEW_ACTION' : '',
    !readViewNamespace ? 'RM_READVIEW_NAMESPACE' : '',
].filter(Boolean);
exports.env = {
    PORT: Number(sourceEnv.PORT ?? process.env.PORT ?? 3014),
    CORS_ORIGIN: corsOrigin,
    CORS_ORIGINS: corsOrigins,
    CORS_ALLOW_ALL: corsOrigins.includes('*'),
    DB_TRUST_CERT: toBoolean(sourceEnv.DB_TRUST_CERT ?? process.env.RM_DB_TRUST_CERT, true),
    READVIEW_URL: readViewUrl,
    READVIEW_USER: readViewUser,
    READVIEW_PASSWORD: readViewPassword,
    READVIEW_ACTION: readViewAction,
    READVIEW_NAMESPACE: readViewNamespace,
    GETSCHEMA_ACTION: sourceEnv.GETSCHEMA_ACTION ?? process.env.RM_GETSCHEMA_ACTION,
    READRECORD_ACTION: sourceEnv.READRECORD_ACTION ?? process.env.RM_READRECORD_ACTION,
    SAVERECORD_ACTION: sourceEnv.SAVERECORD_ACTION ?? process.env.RM_SAVERECORD_ACTION,
    missingRequired,
    isConfigured: missingRequired.length === 0,
};
function buildMissingConfigMessage() {
    if (exports.env.missingRequired.length === 0) {
        return 'Modulo RM configurado.';
    }
    return `Modulo RM nao configurado. Variaveis ausentes: ${exports.env.missingRequired.join(', ')}.`;
}
