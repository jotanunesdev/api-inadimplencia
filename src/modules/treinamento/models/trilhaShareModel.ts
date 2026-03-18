import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type TrilhaShareRecord = {
  ID: string
  TRILHA_ID: string
  MODULO_DESTINO_ID: string
  COMPARTILHADO_POR: string | null
  COMPARTILHADO_EM: Date
  MODULO_DESTINO_NOME?: string | null
}

export async function hasTrilhaShareTable() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT OBJECT_ID('dbo.TTRILHA_SETOR_COMPARTILHAMENTOS') AS TABLE_ID
  `)

  return Boolean(result.recordset[0]?.TABLE_ID)
}

async function ensureTrilhaShareTable() {
  if (await hasTrilhaShareTable()) {
    return
  }

  const error = new Error("Tabela de compartilhamento de trilha ausente")
  ;(error as Error & { code?: string }).code = "TRILHA_SHARE_TABLE_MISSING"
  throw error
}

export async function listTrilhaSharesByTrilha(trilhaId: string) {
  await ensureTrilhaShareTable()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("TRILHA_ID", sql.UniqueIdentifier, trilhaId)
    .query(`
      SELECT
        share.ID,
        share.TRILHA_ID,
        share.MODULO_DESTINO_ID,
        share.COMPARTILHADO_POR,
        share.COMPARTILHADO_EM,
        modulo.NOME AS MODULO_DESTINO_NOME
      FROM dbo.TTRILHA_SETOR_COMPARTILHAMENTOS share
      JOIN dbo.TMODULOS modulo ON modulo.ID = share.MODULO_DESTINO_ID
      WHERE share.TRILHA_ID = @TRILHA_ID
      ORDER BY modulo.NOME
    `)

  return result.recordset as TrilhaShareRecord[]
}

export async function syncTrilhaShares(
  trilhaId: string,
  targetModuleIds: string[],
  compartilhadoPor?: string | null,
) {
  await ensureTrilhaShareTable()
  const pool = await getPool()
  const normalizedTargets = Array.from(
    new Set(
      targetModuleIds
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  )

  await pool
    .request()
    .input("TRILHA_ID", sql.UniqueIdentifier, trilhaId)
    .query(`
      DELETE FROM dbo.TTRILHA_SETOR_COMPARTILHAMENTOS
      WHERE TRILHA_ID = @TRILHA_ID
    `)

  for (const moduleId of normalizedTargets) {
    // eslint-disable-next-line no-await-in-loop
    await pool
      .request()
      .input("ID", sql.UniqueIdentifier, randomUUID())
      .input("TRILHA_ID", sql.UniqueIdentifier, trilhaId)
      .input("MODULO_DESTINO_ID", sql.UniqueIdentifier, moduleId)
      .input("COMPARTILHADO_POR", sql.NVarChar(255), compartilhadoPor ?? null)
      .input("COMPARTILHADO_EM", sql.DateTime2, new Date())
      .query(`
        INSERT INTO dbo.TTRILHA_SETOR_COMPARTILHAMENTOS (
          ID,
          TRILHA_ID,
          MODULO_DESTINO_ID,
          COMPARTILHADO_POR,
          COMPARTILHADO_EM
        )
        VALUES (
          @ID,
          @TRILHA_ID,
          @MODULO_DESTINO_ID,
          @COMPARTILHADO_POR,
          @COMPARTILHADO_EM
        )
      `)
  }

  return listTrilhaSharesByTrilha(trilhaId)
}
