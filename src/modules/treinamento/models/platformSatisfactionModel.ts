import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type PlatformSatisfactionRecord = {
  ID: string
  USUARIO_CPF: string
  NIVEL_SATISFACAO: number
  RESPONDIDO_EM: Date
}

async function ensurePlatformSatisfactionTableExists() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT OBJECT_ID('dbo.TPESQUISA_SATISFACAO_PLATAFORMA', 'U') AS TABLE_ID
  `)
  const exists = Boolean(result.recordset[0]?.TABLE_ID)
  if (!exists) {
    const error = new Error("PLATFORM_SATISFACTION_TABLE_MISSING")
    ;(error as Error & { code?: string }).code = "PLATFORM_SATISFACTION_TABLE_MISSING"
    throw error
  }
}

export async function getLatestPlatformSatisfactionByCpf(cpf: string) {
  await ensurePlatformSatisfactionTableExists()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), cpf)
    .query(`
      SELECT TOP 1 ID, USUARIO_CPF, NIVEL_SATISFACAO, RESPONDIDO_EM
      FROM dbo.TPESQUISA_SATISFACAO_PLATAFORMA
      WHERE USUARIO_CPF = @USUARIO_CPF
      ORDER BY RESPONDIDO_EM DESC
    `)

  return (result.recordset[0] as PlatformSatisfactionRecord | undefined) ?? null
}

export async function createPlatformSatisfaction(input: {
  cpf: string
  nivelSatisfacao: number
  respondidoEm?: Date | null
}) {
  await ensurePlatformSatisfactionTableExists()
  const pool = await getPool()
  const respondidoEm = input.respondidoEm ?? new Date()

  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, randomUUID())
    .input("USUARIO_CPF", sql.VarChar(100), input.cpf)
    .input("NIVEL_SATISFACAO", sql.TinyInt, input.nivelSatisfacao)
    .input("RESPONDIDO_EM", sql.DateTime2, respondidoEm)
    .query(`
      INSERT INTO dbo.TPESQUISA_SATISFACAO_PLATAFORMA (
        ID,
        USUARIO_CPF,
        NIVEL_SATISFACAO,
        RESPONDIDO_EM
      )
      VALUES (
        @ID,
        @USUARIO_CPF,
        @NIVEL_SATISFACAO,
        @RESPONDIDO_EM
      )
    `)

  return { respondidoEm }
}

export async function getPlatformSatisfactionSummary() {
  try {
    await ensurePlatformSatisfactionTableExists()
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : ""
    if (code === "PLATFORM_SATISFACTION_TABLE_MISSING") {
      return [] as Array<{ NIVEL_SATISFACAO: number; TOTAL: number }>
    }
    throw error
  }

  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      NIVEL_SATISFACAO,
      COUNT(*) AS TOTAL
    FROM dbo.TPESQUISA_SATISFACAO_PLATAFORMA
    WHERE NIVEL_SATISFACAO BETWEEN 1 AND 5
    GROUP BY NIVEL_SATISFACAO
    ORDER BY NIVEL_SATISFACAO
  `)

  return result.recordset as Array<{ NIVEL_SATISFACAO: number; TOTAL: number }>
}
