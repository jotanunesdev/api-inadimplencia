import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type SectorFolderShareRecord = {
  ID: string
  SHAREPOINT_ITEM_ID: string
  SETOR_ORIGEM_CHAVE: string
  SETOR_DESTINO_CHAVE: string
  COMPARTILHADO_POR_NOME: string | null
  COMPARTILHADO_POR_EMAIL: string | null
  COMPARTILHADO_POR_USUARIO: string | null
  COMPARTILHADO_EM: Date
}

export async function hasSectorFolderShareTable() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT OBJECT_ID('dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS') AS TABLE_ID
  `)

  return Boolean(result.recordset[0]?.TABLE_ID)
}

export function isSectorFolderShareTableMissingError(error: unknown) {
  const code = (error as Error & { code?: string })?.code
  return code === "SECTOR_FOLDER_SHARE_TABLE_MISSING"
}

async function ensureSectorFolderShareTable() {
  if (await hasSectorFolderShareTable()) {
    return
  }

  const error = new Error(
    "Tabela de compartilhamento de pasta por setor ausente",
  )
  ;(error as Error & { code?: string }).code =
    "SECTOR_FOLDER_SHARE_TABLE_MISSING"
  throw error
}

export async function listSectorFolderSharesByItemId(itemId: string) {
  await ensureSectorFolderShareTable()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), itemId)
    .query(`
      SELECT
        ID,
        SHAREPOINT_ITEM_ID,
        SETOR_ORIGEM_CHAVE,
        SETOR_DESTINO_CHAVE,
        COMPARTILHADO_POR_NOME,
        COMPARTILHADO_POR_EMAIL,
        COMPARTILHADO_POR_USUARIO,
        COMPARTILHADO_EM
      FROM dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS
      WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
      ORDER BY SETOR_DESTINO_CHAVE
    `)

  return result.recordset as SectorFolderShareRecord[]
}

export async function listSectorFolderSharesByTargetSector(
  targetSectorKey: string,
) {
  await ensureSectorFolderShareTable()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("SETOR_DESTINO_CHAVE", sql.NVarChar(120), targetSectorKey)
    .query(`
      SELECT
        ID,
        SHAREPOINT_ITEM_ID,
        SETOR_ORIGEM_CHAVE,
        SETOR_DESTINO_CHAVE,
        COMPARTILHADO_POR_NOME,
        COMPARTILHADO_POR_EMAIL,
        COMPARTILHADO_POR_USUARIO,
        COMPARTILHADO_EM
      FROM dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS
      WHERE SETOR_DESTINO_CHAVE = @SETOR_DESTINO_CHAVE
      ORDER BY COMPARTILHADO_EM DESC, SHAREPOINT_ITEM_ID
    `)

  return result.recordset as SectorFolderShareRecord[]
}

export async function getSectorFolderShareByTargetAndItem(params: {
  itemId: string
  targetSectorKey: string
}) {
  await ensureSectorFolderShareTable()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), params.itemId)
    .input("SETOR_DESTINO_CHAVE", sql.NVarChar(120), params.targetSectorKey)
    .query(`
      SELECT TOP 1
        ID,
        SHAREPOINT_ITEM_ID,
        SETOR_ORIGEM_CHAVE,
        SETOR_DESTINO_CHAVE,
        COMPARTILHADO_POR_NOME,
        COMPARTILHADO_POR_EMAIL,
        COMPARTILHADO_POR_USUARIO,
        COMPARTILHADO_EM
      FROM dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS
      WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
        AND SETOR_DESTINO_CHAVE = @SETOR_DESTINO_CHAVE
    `)

  return (result.recordset[0] as SectorFolderShareRecord | undefined) ?? null
}

export async function syncSectorFolderShares(params: {
  itemId: string
  sourceSectorKey: string
  targetSectorKeys: string[]
  sharedByName?: string | null
  sharedByEmail?: string | null
  sharedByUsername?: string | null
}) {
  await ensureSectorFolderShareTable()
  const pool = await getPool()
  const normalizedTargets = Array.from(
    new Set(
      params.targetSectorKeys
        .map((item) => String(item ?? "").trim().toLowerCase())
        .filter(
          (item) => item && item !== params.sourceSectorKey.trim().toLowerCase(),
        ),
    ),
  )

  await pool
    .request()
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), params.itemId)
    .query(`
      DELETE FROM dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS
      WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
    `)

  for (const targetSectorKey of normalizedTargets) {
    // eslint-disable-next-line no-await-in-loop
    await pool
      .request()
      .input("ID", sql.UniqueIdentifier, randomUUID())
      .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), params.itemId)
      .input(
        "SETOR_ORIGEM_CHAVE",
        sql.NVarChar(120),
        params.sourceSectorKey.trim().toLowerCase(),
      )
      .input("SETOR_DESTINO_CHAVE", sql.NVarChar(120), targetSectorKey)
      .input(
        "COMPARTILHADO_POR_NOME",
        sql.NVarChar(255),
        params.sharedByName ?? null,
      )
      .input(
        "COMPARTILHADO_POR_EMAIL",
        sql.NVarChar(255),
        params.sharedByEmail ?? null,
      )
      .input(
        "COMPARTILHADO_POR_USUARIO",
        sql.NVarChar(255),
        params.sharedByUsername ?? null,
      )
      .input("COMPARTILHADO_EM", sql.DateTime2, new Date())
      .query(`
        INSERT INTO dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS (
          ID,
          SHAREPOINT_ITEM_ID,
          SETOR_ORIGEM_CHAVE,
          SETOR_DESTINO_CHAVE,
          COMPARTILHADO_POR_NOME,
          COMPARTILHADO_POR_EMAIL,
          COMPARTILHADO_POR_USUARIO,
          COMPARTILHADO_EM
        )
        VALUES (
          @ID,
          @SHAREPOINT_ITEM_ID,
          @SETOR_ORIGEM_CHAVE,
          @SETOR_DESTINO_CHAVE,
          @COMPARTILHADO_POR_NOME,
          @COMPARTILHADO_POR_EMAIL,
          @COMPARTILHADO_POR_USUARIO,
          @COMPARTILHADO_EM
        )
      `)
  }

  return listSectorFolderSharesByItemId(params.itemId)
}

export async function deleteSectorFolderSharesByItemIds(itemIds: string[]) {
  await ensureSectorFolderShareTable()
  const normalizedIds = Array.from(
    new Set(
      itemIds.map((item) => String(item ?? "").trim()).filter(Boolean),
    ),
  )

  if (normalizedIds.length === 0) {
    return
  }

  const pool = await getPool()
  const request = pool.request()
  const parameterNames = normalizedIds.map((itemId, index) => {
    const parameterName = `ITEM_ID_${index}`
    request.input(parameterName, sql.NVarChar(255), itemId)
    return `@${parameterName}`
  })

  await request.query(`
    DELETE FROM dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS
    WHERE SHAREPOINT_ITEM_ID IN (${parameterNames.join(", ")})
  `)
}
