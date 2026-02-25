import sql from "mssql"
import { env } from "./env"

const config: sql.config = {
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  server: env.DB_SERVER,
  database: env.DB_DATABASE,
  port: env.DB_PORT,
  options: {
    encrypt: env.DB_ENCRYPT,
    trustServerCertificate: env.DB_TRUST_CERT,
  },
}

let poolPromise: Promise<sql.ConnectionPool> | null = null

export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect()
  }

  return poolPromise
}

export { sql }