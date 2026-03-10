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
const sourceEnv = resolvePrefixedEnv('AUTH');
const corsOrigin = sourceEnv.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? '*';
const corsOrigins = corsOrigin
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
const ldapUrl = sourceEnv.LDAP_URL ?? process.env.AUTH_LDAP_URL ?? '';
const ldapBaseDn = sourceEnv.LDAP_BASE_DN ?? process.env.AUTH_LDAP_BASE_DN ?? '';
const ldapBindUser = sourceEnv.LDAP_BIND_USER ?? process.env.AUTH_LDAP_BIND_USER ?? '';
const ldapBindPassword = sourceEnv.LDAP_BIND_PASSWORD ?? process.env.AUTH_LDAP_BIND_PASSWORD ?? '';
const jwtSecret = sourceEnv.JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? '';
const missingRequired = [
    !ldapUrl ? 'AUTH_LDAP_URL' : '',
    !ldapBaseDn ? 'AUTH_LDAP_BASE_DN' : '',
    !ldapBindUser ? 'AUTH_LDAP_BIND_USER' : '',
    !ldapBindPassword ? 'AUTH_LDAP_BIND_PASSWORD' : '',
    !jwtSecret ? 'AUTH_JWT_SECRET' : '',
].filter(Boolean);
exports.env = {
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
function buildMissingConfigMessage() {
    if (exports.env.missingRequired.length === 0) {
        return 'Modulo Auth configurado.';
    }
    return `Modulo Auth nao configurado. Variaveis ausentes: ${exports.env.missingRequired.join(', ')}.`;
}
