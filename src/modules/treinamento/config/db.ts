import sql from "mssql"
import { env } from "./env"

const config: sql.config = {
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  server: env.DB_SERVER,
  database: env.DB_DATABASE,
  port: env.DB_INSTANCE ? undefined : env.DB_PORT,
  options: {
    encrypt: env.DB_ENCRYPT,
    instanceName: env.DB_INSTANCE,
    trustServerCertificate: env.DB_TRUST_CERT,
  },
  connectionTimeout: env.DB_CONNECTION_TIMEOUT_MS,
  requestTimeout: env.DB_REQUEST_TIMEOUT_MS,
}

let poolPromise: Promise<sql.ConnectionPool> | null = null
let retryCount = 0
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000] // Exponential backoff

/**
 * Reseta o pool de conexões para permitir novo ciclo de retry
 */
export function resetPool(): void {
  poolPromise = null
  retryCount = 0
}

/**
 * Retorna métricas do pool de conexões e verifica saúde
 */
export async function healthCheckPool(): Promise<{
  connected: boolean
  activeConnections: number
  idleConnections: number
  waitingRequests: number
}> {
  if (!poolPromise) {
    return {
      connected: false,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
    }
  }

  try {
    const pool = await poolPromise
    // Health check simples
    await pool.request().query("SELECT 1")

    return {
      connected: pool.connected,
      activeConnections: (pool as unknown as { size: number }).size || 0,
      idleConnections: (pool as unknown as { available: number }).available || 0,
      waitingRequests: (pool as unknown as { pending: number }).pending || 0,
    }
  } catch {
    return {
      connected: false,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
    }
  }
}

/**
 * Obtém o pool de conexões com retry exponencial
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = (async () => {
      let lastError: Error | null = null

      while (retryCount <= MAX_RETRIES) {
        try {
          const pool = await new sql.ConnectionPool(config).connect()
          retryCount = 0 // Reset após sucesso
          return pool
        } catch (error) {
          lastError = error as Error
          retryCount++

          if (retryCount > MAX_RETRIES) {
            break
          }

          // Exponential backoff
          const delay = RETRY_DELAYS[Math.min(retryCount - 1, RETRY_DELAYS.length - 1)]
          console.warn({
            level: "WARN",
            event: "DB_POOL_RETRY",
            attempt: retryCount,
            maxRetries: MAX_RETRIES,
            delayMs: delay,
            error: lastError.message,
          })

          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      // Esgotou retries
      retryCount = 0
      throw new Error(
        `Falha ao conectar ao banco de dados após ${MAX_RETRIES} tentativas: ${lastError?.message}`
      )
    })()
  }

  return poolPromise
}

export { sql }
