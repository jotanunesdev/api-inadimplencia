"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
exports.getPool = getPool;
const mssql_1 = __importDefault(require("mssql"));
exports.sql = mssql_1.default;
const env_1 = require("./env");
const errors_1 = require("../types/errors");
let poolPromise = null;
function buildConfig() {
    if (!env_1.env.isConfigured) {
        throw new errors_1.AppError(500, (0, env_1.buildMissingConfigMessage)(), 'ESTOQUE_NOT_CONFIGURED', {
            missingRequired: env_1.env.missingRequired,
        });
    }
    return {
        user: env_1.env.DB_USER,
        password: env_1.env.DB_PASSWORD,
        server: env_1.env.DB_SERVER,
        database: env_1.env.DB_DATABASE,
        port: env_1.env.DB_INSTANCE ? undefined : env_1.env.DB_PORT,
        options: {
            encrypt: env_1.env.DB_ENCRYPT,
            trustServerCertificate: env_1.env.DB_TRUST_CERT,
            instanceName: env_1.env.DB_INSTANCE,
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
        },
    };
}
async function getPool() {
    if (!poolPromise) {
        poolPromise = new mssql_1.default.ConnectionPool(buildConfig()).connect();
    }
    return poolPromise;
}
