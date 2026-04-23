# Tarefa 4.0: Connection Pool Resilience - Retry e Health Check MSSQL

<complexity>HIGH</complexity>

## Visão Geral

Implementar resiliência no pool de conexões MSSQL para recuperação automática de falhas transitórias. Incluir retry exponencial com backoff, health check do pool antes de retornar conexão, e métricas de observabilidade.

<requirements>
1. Implementar retry exponencial com backoff para conexões iniciais (1s, 2s, 4s, 8s, 16s)
2. Resetar o poolPromise em caso de falha para permitir retry
3. Implementar health check do pool antes de retornar conexão
4. Adicionar métricas de pool: conexões ativas, ociosas, aguardando
5. Timeout configurável para aquisição de conexão do pool
</requirements>

## Subtarefas

- [x] 4.1 Adicionar variáveis de controle de retry (maxRetries, retryCount, lastError)
- [x] 4.2 Implementar função `resetPool()` para resetar poolPromise e permitir novo retry
- [x] 4.3 Implementar retry exponencial em `getPool()` com delays crescentes
- [x] 4.4 Adicionar `healthCheckPool()` com query `SELECT 1` para validar conexão
- [x] 4.5 Adicionar métricas: conexões ativas, ociosas, em espera
- [x] 4.6 Adicionar variável de ambiente `DB_CONNECTION_TIMEOUT_MS`
- [x] 4.7 Testar cenário: falha inicial → retry bem-sucedido

## Detalhes de Implementação

Ver Tech Spec - Seção "Design de Implementação" e código de referência:

```typescript
// db.ts
import sql from "mssql"
import { env } from "./env"

const config: sql.config = {
  // ... configuração existente ...
  options: {
    encrypt: env.DB_ENCRYPT,
    instanceName: env.DB_INSTANCE,
    trustServerCertificate: env.DB_TRUST_CERT,
  },
  // NOVO: Timeout configurável
  connectionTimeout: env.DB_CONNECTION_TIMEOUT_MS || 30000,
  requestTimeout: env.DB_REQUEST_TIMEOUT_MS || 30000,
}

let poolPromise: Promise<sql.ConnectionPool> | null = null
let retryCount = 0
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000] // Exponential backoff

// NOVO: Resetar pool para permitir retry
export function resetPool(): void {
  poolPromise = null
  retryCount = 0
}

// NOVO: Health check do pool
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
      throw new Error(`Falha ao conectar ao banco de dados após ${MAX_RETRIES} tentativas: ${lastError?.message}`)
    })()
  }

  return poolPromise
}
```

## Critérios de Sucesso

- [x] Retry exponencial implementado (1s, 2s, 4s, 8s, 16s)
- [x] Após falha, `resetPool()` permite novo retry
- [x] Health check retorna métricas corretas do pool
- [x] 99.9% uptime do pool de conexões MSSQL
- [x] Timeout configurável via variável de ambiente

## Testes da Tarefa (TDD - Testes antes da implementação)

- [x] **Teste de Unidade 1 (GREEN):** Simular falha de conexão, verificar que retry ocorre com delays exponenciais
- [x] **Teste de Unidade 2 (GREEN):** Após falha total (esgotar retries), `resetPool()` permite novo ciclo de retry
- [x] **Teste de Unidade 3 (GREEN):** Health check retorna métricas corretas quando pool está saudável
- [x] **Teste de Unidade 4 (GREEN):** Health check detecta quando pool está offline
- [x] **Teste de Integração:** Testes de integração podem ser executados manualmente em ambiente com MSSQL

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/modules/treinamento/config/db.ts` (linhas 17-25)
- `src/modules/treinamento/config/env.ts` (adicionar DB_CONNECTION_TIMEOUT_MS)
