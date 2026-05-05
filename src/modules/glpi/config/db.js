const mysql = require('mysql2/promise');
const { env } = require('./env');

const GLPI_SCHEMA_SQL = 'USE glpi;';

let poolPromise = null;

function withGlpiSchema(sql) {
  return `${GLPI_SCHEMA_SQL}\n${String(sql ?? '').trimStart()}`;
}

function getLastResultSet(results) {
  if (!Array.isArray(results)) {
    return results;
  }

  return results[results.length - 1];
}

function createStructuredError(message, code, details, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function buildPool() {
  if (!env.isConfigured) {
    throw createStructuredError(
      'Modulo GLPI nao configurado.',
      'GLPI_NOT_CONFIGURED',
      { missingRequired: env.missingRequired }
    );
  }

  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
    connectionLimit: 10,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: true,
    timezone: 'Z',
  });
}

function getPool() {
  if (!poolPromise) {
    poolPromise = Promise.resolve(buildPool());
  }

  return poolPromise;
}

async function pingPool() {
  const pool = await getPool();
  const timeout = Math.min(env.QUERY_TIMEOUT_MS, 1000);
  const [results] = await pool.query({ sql: withGlpiSchema('SELECT 1 AS ok'), timeout });
  const rows = getLastResultSet(results);

  return Array.isArray(rows) && rows.length > 0;
}

module.exports = {
  getPool,
  pingPool,
  getLastResultSet,
  withGlpiSchema,
};
