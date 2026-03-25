"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const { resolvePrefixedEnv } = require("../../../shared/moduleEnv");
dotenv_1.default.config({
    path: path_1.default.resolve(__dirname, "..", "..", "..", "..", ".env"),
});
dotenv_1.default.config({
    path: path_1.default.resolve(__dirname, "..", ".env"),
});
const envSource = resolvePrefixedEnv("TREIN");
const rmEnvSource = resolvePrefixedEnv("RM");
function requireEnv(name, fallback) {
    const value = envSource[name] ?? fallback;
    if (value === undefined || value === "") {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
}
function requireReadViewEnv(name, fallback) {
    const value = rmEnvSource[name] ?? envSource[name] ?? fallback;
    if (value === undefined || value === "") {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
}
function resolveReadViewEnv(name, fallback) {
    return rmEnvSource[name] ?? envSource[name] ?? fallback;
}
function parsePositiveNumber(name, fallback) {
    const raw = envSource[name];
    if (raw === undefined || raw === "") {
        return fallback;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid environment variable: ${name}`);
    }
    return value;
}
function parseServerAndInstance(rawValue) {
    const normalized = rawValue.trim();
    const splitChar = normalized.includes("\\") ? "\\" : "/";
    const [server, instance] = normalized.split(splitChar);
    return {
        instance: instance?.trim() || undefined,
        server: server?.trim() ?? "",
    };
}
const corsOrigin = process.env.CORS_ORIGIN ?? envSource.CORS_ORIGIN ?? "*";
const parsedDbServer = parseServerAndInstance(requireEnv("DB_SERVER"));
exports.env = {
    NODE_ENV: envSource.NODE_ENV ?? "development",
    PORT: Number(envSource.PORT ?? 4000),
    UPLOAD_MAX_FILE_SIZE_MB: parsePositiveNumber("UPLOAD_MAX_FILE_SIZE_MB", 1024),
    SP_UPLOAD_CHUNK_MB: parsePositiveNumber("SP_UPLOAD_CHUNK_MB", 20),
    CORS_ORIGIN: corsOrigin,
    CORS_ORIGINS: corsOrigin
        .split(",")
        .map((origin) => origin.trim().toLowerCase())
        .filter(Boolean),
    CORS_ALLOW_ALL: corsOrigin
        .split(",")
        .map((origin) => origin.trim().toLowerCase())
        .filter(Boolean)
        .includes("*"),
    DB_SERVER: parsedDbServer.server,
    DB_INSTANCE: envSource.DB_INSTANCE ?? parsedDbServer.instance,
    DB_PORT: Number(envSource.DB_PORT ?? 1433),
    DB_DATABASE: requireEnv("DB_DATABASE"),
    DB_USER: requireEnv("DB_USER"),
    DB_PASSWORD: requireEnv("DB_PASSWORD"),
    DB_ENCRYPT: (envSource.DB_ENCRYPT ?? "false").toLowerCase() === "true",
    DB_TRUST_CERT: (envSource.DB_TRUST_CERT ?? "true").toLowerCase() === "true",
    PUBLIC_ASSETS_ROOT: envSource.PUBLIC_ASSETS_ROOT ??
        "C:\\gestao-trienamento\\gestao-treinamento\\public",
    READVIEW_URL: requireReadViewEnv("READVIEW_URL"),
    READVIEW_USER: requireReadViewEnv("READVIEW_USER"),
    READVIEW_PASSWORD: requireReadViewEnv("READVIEW_PASSWORD"),
    READVIEW_ACTION: resolveReadViewEnv("READVIEW_ACTION"),
    READVIEW_NAMESPACE: resolveReadViewEnv("READVIEW_NAMESPACE", "http://www.totvs.com/"),
    SHAREPOINT_ENABLED: (envSource.SHAREPOINT_ENABLED ?? "false").toLowerCase() === "true",
    SHAREPOINT_TENANT_ID: envSource.SP_TENANT_ID,
    SHAREPOINT_CLIENT_ID: envSource.SP_CLIENT_ID,
    SHAREPOINT_CLIENT_SECRET: envSource.SP_CLIENT_SECRET,
    SHAREPOINT_SITE_URL: envSource.SP_SITE_URL,
    SHAREPOINT_LIBRARY_NAME: envSource.SP_LIBRARY_NAME ?? "Documentos Compartilhados",
    SHAREPOINT_ROOT_FOLDER: envSource.SP_ROOT_FOLDER ?? "Treinamento",
    COLLECTIVE_PROVA_TOKEN_SECRET: envSource.COLLECTIVE_PROVA_TOKEN_SECRET ?? "change-me-collective-prova-secret",
    COLLECTIVE_PROVA_TOKEN_TTL_MINUTES: parsePositiveNumber("COLLECTIVE_PROVA_TOKEN_TTL_MINUTES", 180),
    COLLECTIVE_PROVA_REDIRECT_BASE_URL: envSource.COLLECTIVE_PROVA_REDIRECT_BASE_URL ??
        "https://treinamento.jotanunes.com",
};
