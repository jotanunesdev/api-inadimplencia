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
const config = {
    user: env_1.env.DB_USER,
    password: env_1.env.DB_PASSWORD,
    server: env_1.env.DB_SERVER,
    database: env_1.env.DB_DATABASE,
    port: env_1.env.DB_INSTANCE ? undefined : env_1.env.DB_PORT,
    options: {
        encrypt: env_1.env.DB_ENCRYPT,
        instanceName: env_1.env.DB_INSTANCE,
        trustServerCertificate: env_1.env.DB_TRUST_CERT,
    },
};
let poolPromise = null;
function getPool() {
    if (!poolPromise) {
        poolPromise = new mssql_1.default.ConnectionPool(config).connect();
    }
    return poolPromise;
}
