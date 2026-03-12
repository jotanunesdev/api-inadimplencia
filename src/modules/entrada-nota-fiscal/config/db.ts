import sql from 'mssql';
import { env, buildMissingConfigMessage } from './env';
import { AppError } from '../types/errors';

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function buildConfig(): sql.config {
  if (!env.isConfigured) {
    throw new AppError(
      500,
      buildMissingConfigMessage(),
      'ENTRADA_NOTA_FISCAL_NOT_CONFIGURED',
      {
        missingRequired: env.missingRequired,
      }
    );
  }

  return {
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    server: env.DB_SERVER,
    database: env.DB_DATABASE,
    port: env.DB_INSTANCE ? undefined : env.DB_PORT,
    options: {
      encrypt: env.DB_ENCRYPT,
      trustServerCertificate: env.DB_TRUST_CERT,
      instanceName: env.DB_INSTANCE,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig()).connect();
  }

  return poolPromise;
}

export { sql };
