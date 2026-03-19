import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type SectorFolderUserItemRecord = {
  ID: string
  SHAREPOINT_ITEM_ID: string
  SETOR_VISUALIZACAO_CHAVE: string
  SETOR_ORIGEM_CHAVE: string
  RAIZ_COMPARTILHADA_ITEM_ID: string | null
  USUARIO: string
  FAVORITO: boolean
  ULTIMO_ACESSO_EM: Date | null
  CRIADO_EM: Date
  ATUALIZADO_EM: Date
}

type UserItemUpsertParams = {
  itemId: string
  viewerSectorKey: string
  sourceSectorKey: string
  sharedRootItemId?: string | null
  username: string
}

const TABLE_NAME = "dbo.TGESTAO_ARQUIVOS_SETOR_USUARIO_ITENS"

export function isSectorFolderUserItemTableMissingError(error: unknown) {
  const code = (error as Error & { code?: string })?.code
  return code === "SECTOR_FOLDER_USER_ITEM_TABLE_MISSING"
}

async function ensureSectorFolderUserItemTable() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT OBJECT_ID('${TABLE_NAME}', 'U') AS TABLE_ID
  `)

  if (result.recordset[0]?.TABLE_ID) {
    return
  }

  const error = new Error("Tabela de itens de usuario do gerenciador ausente")
  ;(error as Error & { code?: string }).code =
    "SECTOR_FOLDER_USER_ITEM_TABLE_MISSING"
  throw error
}

export async function listSectorFolderUserItemRelationsByItemIds(params: {
  viewerSectorKey: string
  username: string
  itemIds: string[]
}) {
  await ensureSectorFolderUserItemTable()

  const normalizedIds = Array.from(
    new Set(params.itemIds.map((item) => String(item ?? "").trim()).filter(Boolean)),
  )
  if (normalizedIds.length === 0) {
    return [] as SectorFolderUserItemRecord[]
  }

  const pool = await getPool()
  const request = pool
    .request()
    .input(
      "SETOR_VISUALIZACAO_CHAVE",
      sql.NVarChar(120),
      params.viewerSectorKey,
    )
    .input("USUARIO", sql.NVarChar(255), params.username)

  const parameterNames = normalizedIds.map((itemId, index) => {
    const parameterName = `ITEM_ID_${index}`
    request.input(parameterName, sql.NVarChar(255), itemId)
    return `@${parameterName}`
  })

  const result = await request.query(`
    SELECT
      ID,
      SHAREPOINT_ITEM_ID,
      SETOR_VISUALIZACAO_CHAVE,
      SETOR_ORIGEM_CHAVE,
      RAIZ_COMPARTILHADA_ITEM_ID,
      USUARIO,
      FAVORITO,
      ULTIMO_ACESSO_EM,
      CRIADO_EM,
      ATUALIZADO_EM
    FROM ${TABLE_NAME}
    WHERE SETOR_VISUALIZACAO_CHAVE = @SETOR_VISUALIZACAO_CHAVE
      AND USUARIO = @USUARIO
      AND SHAREPOINT_ITEM_ID IN (${parameterNames.join(", ")})
  `)

  return result.recordset as SectorFolderUserItemRecord[]
}

export async function listFavoriteSectorFolderUserItems(params: {
  viewerSectorKey: string
  username: string
}) {
  await ensureSectorFolderUserItemTable()
  const pool = await getPool()
  const result = await pool
    .request()
    .input(
      "SETOR_VISUALIZACAO_CHAVE",
      sql.NVarChar(120),
      params.viewerSectorKey,
    )
    .input("USUARIO", sql.NVarChar(255), params.username)
    .query(`
      SELECT
        ID,
        SHAREPOINT_ITEM_ID,
        SETOR_VISUALIZACAO_CHAVE,
        SETOR_ORIGEM_CHAVE,
        RAIZ_COMPARTILHADA_ITEM_ID,
        USUARIO,
        FAVORITO,
        ULTIMO_ACESSO_EM,
        CRIADO_EM,
        ATUALIZADO_EM
      FROM ${TABLE_NAME}
      WHERE SETOR_VISUALIZACAO_CHAVE = @SETOR_VISUALIZACAO_CHAVE
        AND USUARIO = @USUARIO
        AND FAVORITO = 1
      ORDER BY ATUALIZADO_EM DESC, SHAREPOINT_ITEM_ID
    `)

  return result.recordset as SectorFolderUserItemRecord[]
}

export async function listRecentSectorFolderUserItems(params: {
  viewerSectorKey: string
  username: string
  withinDays?: number
}) {
  await ensureSectorFolderUserItemTable()
  const pool = await getPool()
  const withinDays = Number(params.withinDays ?? 15)
  const result = await pool
    .request()
    .input(
      "SETOR_VISUALIZACAO_CHAVE",
      sql.NVarChar(120),
      params.viewerSectorKey,
    )
    .input("USUARIO", sql.NVarChar(255), params.username)
    .input("WITHIN_DAYS", sql.Int, withinDays)
    .query(`
      SELECT
        ID,
        SHAREPOINT_ITEM_ID,
        SETOR_VISUALIZACAO_CHAVE,
        SETOR_ORIGEM_CHAVE,
        RAIZ_COMPARTILHADA_ITEM_ID,
        USUARIO,
        FAVORITO,
        ULTIMO_ACESSO_EM,
        CRIADO_EM,
        ATUALIZADO_EM
      FROM ${TABLE_NAME}
      WHERE SETOR_VISUALIZACAO_CHAVE = @SETOR_VISUALIZACAO_CHAVE
        AND USUARIO = @USUARIO
        AND ULTIMO_ACESSO_EM IS NOT NULL
        AND ULTIMO_ACESSO_EM >= DATEADD(DAY, -@WITHIN_DAYS, SYSUTCDATETIME())
      ORDER BY ULTIMO_ACESSO_EM DESC, SHAREPOINT_ITEM_ID
    `)

  return result.recordset as SectorFolderUserItemRecord[]
}

async function ensureUserItemRecord(params: UserItemUpsertParams) {
  await ensureSectorFolderUserItemTable()
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, randomUUID())
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), params.itemId)
    .input(
      "SETOR_VISUALIZACAO_CHAVE",
      sql.NVarChar(120),
      params.viewerSectorKey,
    )
    .input("SETOR_ORIGEM_CHAVE", sql.NVarChar(120), params.sourceSectorKey)
    .input(
      "RAIZ_COMPARTILHADA_ITEM_ID",
      sql.NVarChar(255),
      params.sharedRootItemId ?? null,
    )
    .input("USUARIO", sql.NVarChar(255), params.username)
    .query(`
      IF NOT EXISTS (
        SELECT 1
        FROM ${TABLE_NAME}
        WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
          AND SETOR_VISUALIZACAO_CHAVE = @SETOR_VISUALIZACAO_CHAVE
          AND USUARIO = @USUARIO
      )
      BEGIN
        INSERT INTO ${TABLE_NAME} (
          ID,
          SHAREPOINT_ITEM_ID,
          SETOR_VISUALIZACAO_CHAVE,
          SETOR_ORIGEM_CHAVE,
          RAIZ_COMPARTILHADA_ITEM_ID,
          USUARIO,
          FAVORITO,
          ULTIMO_ACESSO_EM,
          CRIADO_EM,
          ATUALIZADO_EM
        )
        VALUES (
          @ID,
          @SHAREPOINT_ITEM_ID,
          @SETOR_VISUALIZACAO_CHAVE,
          @SETOR_ORIGEM_CHAVE,
          @RAIZ_COMPARTILHADA_ITEM_ID,
          @USUARIO,
          0,
          NULL,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
        )
      END
    `)
}

export async function registerSectorFolderAccess(params: UserItemUpsertParams) {
  await ensureUserItemRecord(params)
  const pool = await getPool()
  await pool
    .request()
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), params.itemId)
    .input(
      "SETOR_VISUALIZACAO_CHAVE",
      sql.NVarChar(120),
      params.viewerSectorKey,
    )
    .input("SETOR_ORIGEM_CHAVE", sql.NVarChar(120), params.sourceSectorKey)
    .input(
      "RAIZ_COMPARTILHADA_ITEM_ID",
      sql.NVarChar(255),
      params.sharedRootItemId ?? null,
    )
    .input("USUARIO", sql.NVarChar(255), params.username)
    .query(`
      UPDATE ${TABLE_NAME}
      SET
        SETOR_ORIGEM_CHAVE = @SETOR_ORIGEM_CHAVE,
        RAIZ_COMPARTILHADA_ITEM_ID = @RAIZ_COMPARTILHADA_ITEM_ID,
        ULTIMO_ACESSO_EM = SYSUTCDATETIME(),
        ATUALIZADO_EM = SYSUTCDATETIME()
      WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
        AND SETOR_VISUALIZACAO_CHAVE = @SETOR_VISUALIZACAO_CHAVE
        AND USUARIO = @USUARIO
    `)
}

export async function setSectorFolderFavorite(
  params: UserItemUpsertParams & { favorite: boolean },
) {
  await ensureUserItemRecord(params)
  const pool = await getPool()
  await pool
    .request()
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), params.itemId)
    .input(
      "SETOR_VISUALIZACAO_CHAVE",
      sql.NVarChar(120),
      params.viewerSectorKey,
    )
    .input("SETOR_ORIGEM_CHAVE", sql.NVarChar(120), params.sourceSectorKey)
    .input(
      "RAIZ_COMPARTILHADA_ITEM_ID",
      sql.NVarChar(255),
      params.sharedRootItemId ?? null,
    )
    .input("USUARIO", sql.NVarChar(255), params.username)
    .input("FAVORITO", sql.Bit, params.favorite)
    .query(`
      UPDATE ${TABLE_NAME}
      SET
        SETOR_ORIGEM_CHAVE = @SETOR_ORIGEM_CHAVE,
        RAIZ_COMPARTILHADA_ITEM_ID = @RAIZ_COMPARTILHADA_ITEM_ID,
        FAVORITO = @FAVORITO,
        ATUALIZADO_EM = SYSUTCDATETIME()
      WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
        AND SETOR_VISUALIZACAO_CHAVE = @SETOR_VISUALIZACAO_CHAVE
        AND USUARIO = @USUARIO
    `)
}

export async function deleteSectorFolderUserItemsByItemIds(itemIds: string[]) {
  await ensureSectorFolderUserItemTable()
  const normalizedIds = Array.from(
    new Set(itemIds.map((item) => String(item ?? "").trim()).filter(Boolean)),
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
    DELETE FROM ${TABLE_NAME}
    WHERE SHAREPOINT_ITEM_ID IN (${parameterNames.join(", ")})
  `)
}
