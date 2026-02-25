const sql = require('mssql');
const { env } = require('./env');

let poolPromise;

function buildConfig() {
  const {
    DB_USER,
    DB_PASSWORD,
    DB_SERVER,
    DB_DATABASE,
    DB_PORT,
    DB_ENCRYPT,
    DB_TRUST_CERT,
  } = env;

  if (!DB_USER || !DB_PASSWORD || !DB_SERVER || !DB_DATABASE) {
    throw new Error(
      'Variaveis de ambiente obrigatorias: DB_USER, DB_PASSWORD, DB_SERVER, DB_DATABASE.'
    );
  }

  return {
    user: DB_USER,
    password: DB_PASSWORD,
    server: DB_SERVER,
    database: DB_DATABASE,
    port: DB_PORT ? Number(DB_PORT) : 1433,
    options: {
      encrypt: DB_ENCRYPT === 'true',
      trustServerCertificate: DB_TRUST_CERT !== 'false',
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
    const config = buildConfig();
    poolPromise = sql.connect(config);
  }

  return poolPromise;
}

module.exports = {
  sql,
  getPool,
};
