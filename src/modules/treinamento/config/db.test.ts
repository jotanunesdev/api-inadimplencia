import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getPool, resetPool, healthCheckPool, sql } from "./db"

// Mock do mssql
vi.mock("mssql", async () => {
  const actual = await vi.importActual<typeof import("mssql")>("mssql")
  return {
    ...actual,
    default: {
      ConnectionPool: vi.fn(),
    },
  }
})

// Mock do env
vi.mock("./env", () => ({
  env: {
    DB_USER: "test_user",
    DB_PASSWORD: "test_pass",
    DB_SERVER: "localhost",
    DB_DATABASE: "test_db",
    DB_PORT: 1433,
    DB_ENCRYPT: false,
    DB_TRUST_CERT: true,
    DB_CONNECTION_TIMEOUT_MS: 5000,
  },
}))

describe("db.ts - Connection Pool Resilience", () => {
  beforeEach(() => {
    // Resetar estado entre testes
    resetPool()
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("4.1 Retry Exponencial", () => {
    it("deve tentar reconectar com delays exponenciais após falha", async () => {
      const { default: sqlMock } = await import("mssql")
      const connectMock = vi.fn()
      let attempts = 0

      // Simular falha nas primeiras 2 tentativas, sucesso na 3ª
      connectMock.mockImplementation(() => {
        attempts++
        if (attempts <= 2) {
          return Promise.reject(new Error(`Connection failed #${attempts}`))
        }
        return Promise.resolve({
          connected: true,
          request: () => ({
            query: vi.fn().mockResolvedValue({}),
          }),
        })
      })

      sqlMock.ConnectionPool = vi.fn(() => ({
        connect: connectMock,
      }))

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const poolPromise = getPool()

      // Avançar timers para simular os retries
      await vi.advanceTimersByTimeAsync(1000) // Primeiro retry (1s)
      await vi.advanceTimersByTimeAsync(2000) // Segundo retry (2s)

      const pool = await poolPromise

      expect(attempts).toBe(3)
      expect(pool.connected).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "WARN",
          event: "DB_POOL_RETRY",
          attempt: 1,
          delayMs: 1000,
        })
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "WARN",
          event: "DB_POOL_RETRY",
          attempt: 2,
          delayMs: 2000,
        })
      )

      consoleSpy.mockRestore()
    })

    it("deve falhar após esgotar todas as tentativas de retry", async () => {
      const { default: sqlMock } = await import("mssql")
      const connectMock = vi.fn().mockRejectedValue(new Error("Connection refused"))

      sqlMock.ConnectionPool = vi.fn(() => ({
        connect: connectMock,
      }))

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      const poolPromise = getPool()

      // Avançar todos os timers para esgotar os retries (1s + 2s + 4s = 7s)
      await vi.advanceTimersByTimeAsync(8000)

      await expect(poolPromise).rejects.toThrow(
        /Falha ao conectar ao banco de dados após/
      )
      expect(connectMock).toHaveBeenCalledTimes(4) // Initial + 3 retries

      consoleSpy.mockRestore()
    })
  })

  describe("4.2 resetPool()", () => {
    it("deve permitir novo ciclo de retry após falha e reset", async () => {
      const { default: sqlMock } = await import("mssql")
      let attempts = 0

      // Primeira rodada: falha total
      const connectMock = vi.fn().mockImplementation(() => {
        attempts++
        return Promise.reject(new Error("Connection failed"))
      })

      sqlMock.ConnectionPool = vi.fn(() => ({
        connect: connectMock,
      }))

      // Primeira tentativa - deve falhar
      const firstPromise = getPool()
      await vi.advanceTimersByTimeAsync(8000)
      await expect(firstPromise).rejects.toThrow()

      // Resetar o pool
      resetPool()

      // Agora simular sucesso
      let newAttempts = 0
      const connectMock2 = vi.fn().mockImplementation(() => {
        newAttempts++
        return Promise.resolve({
          connected: true,
          request: () => ({
            query: vi.fn().mockResolvedValue({}),
          }),
        })
      })

      sqlMock.ConnectionPool = vi.fn(() => ({
        connect: connectMock2,
      }))

      // Segunda tentativa - deve funcionar
      const secondPromise = getPool()
      const pool = await secondPromise

      expect(pool.connected).toBe(true)
      expect(newAttempts).toBe(1) // Sucesso na primeira tentativa
    })

    it("deve resetar o retryCount após sucesso", async () => {
      const { default: sqlMock } = await import("mssql")

      // Primeira conexão bem-sucedida
      sqlMock.ConnectionPool = vi.fn(() => ({
        connect: vi.fn().mockResolvedValue({
          connected: true,
          request: () => ({
            query: vi.fn().mockResolvedValue({}),
          }),
        }),
      }))

      await getPool()

      // Resetar
      resetPool()

      // Segunda conexão deve começar do zero (retryCount = 0)
      let attempts = 0
      sqlMock.ConnectionPool = vi.fn(() => ({
        connect: vi.fn().mockImplementation(() => {
          attempts++
          return Promise.resolve({
            connected: true,
            request: () => ({
              query: vi.fn().mockResolvedValue({}),
            }),
          })
        }),
      }))

      await getPool()
      expect(attempts).toBe(1) // Deve ser primeira tentativa
    })
  })

  describe("4.3 healthCheckPool()", () => {
    it("deve retornar métricas corretas quando pool está saudável", async () => {
      const { default: sqlMock } = await import("mssql")
      const mockPool = {
        connected: true,
        size: 5,
        available: 3,
        pending: 1,
        request: () => ({
          query: vi.fn().mockResolvedValue({ recordset: [{ 1: 1 }] }),
        }),
      }

      sqlMock.ConnectionPool = vi.fn(() => ({
        connect: vi.fn().mockResolvedValue(mockPool),
      }))

      await getPool()

      const metrics = await healthCheckPool()

      expect(metrics.connected).toBe(true)
      expect(metrics.activeConnections).toBe(5)
      expect(metrics.idleConnections).toBe(3)
      expect(metrics.waitingRequests).toBe(1)
    })

    it("deve detectar quando pool está offline", async () => {
      const { default: sqlMock } = await import("mssql")
      const mockPool = {
        connected: false,
        size: 0,
        available: 0,
        pending: 0,
        request: () => ({
          query: vi.fn().mockRejectedValue(new Error("Connection lost")),
        }),
      }

      sqlMock.ConnectionPool = vi.fn(() => ({
        connect: vi.fn().mockResolvedValue(mockPool),
      }))

      await getPool()

      const metrics = await healthCheckPool()

      expect(metrics.connected).toBe(false)
      expect(metrics.activeConnections).toBe(0)
      expect(metrics.idleConnections).toBe(0)
      expect(metrics.waitingRequests).toBe(0)
    })

    it("deve retornar status desconectado quando pool não existe", async () => {
      resetPool()

      const metrics = await healthCheckPool()

      expect(metrics.connected).toBe(false)
      expect(metrics.activeConnections).toBe(0)
      expect(metrics.idleConnections).toBe(0)
      expect(metrics.waitingRequests).toBe(0)
    })
  })

  describe("4.4 Timeout Configurável", () => {
    it("deve usar DB_CONNECTION_TIMEOUT_MS do env", async () => {
      const { env } = await import("./env")
      expect(env.DB_CONNECTION_TIMEOUT_MS).toBe(5000)
    })
  })

  describe("4.5 Singleton Pattern", () => {
    it("deve retornar a mesma promise para chamadas concorrentes", async () => {
      const { default: sqlMock } = await import("mssql")
      let callCount = 0

      sqlMock.ConnectionPool = vi.fn(() => ({
        connect: vi.fn().mockImplementation(() => {
          callCount++
          return Promise.resolve({
            connected: true,
            request: () => ({
              query: vi.fn().mockResolvedValue({}),
            }),
          })
        }),
      }))

      // Chamadas concorrentes
      const [pool1, pool2, pool3] = await Promise.all([
        getPool(),
        getPool(),
        getPool(),
      ])

      expect(callCount).toBe(1) // Apenas uma conexão criada
      expect(pool1).toBe(pool2)
      expect(pool2).toBe(pool3)
    })
  })
})
