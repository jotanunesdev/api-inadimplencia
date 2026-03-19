import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type SectorFolderTrashRecord = {
  ID: string
  SHAREPOINT_ITEM_ID: string
  SETOR_CHAVE: string
  NOME: string
  CAMINHO: string
  TIPO_ITEM: string
  EXTENSAO: string | null
  TAMANHO: number | null
  WEB_URL: string | null
  EXCLUIDO_POR_NOME: string | null
  EXCLUIDO_POR_EMAIL: string | null
  EXCLUIDO_POR_USUARIO: string | null
  EXCLUIDO_EM: Date
}

export type SectorFolderTrashInput = {
  itemId: string
  sectorKey: string
  name: string
  path: string
  itemType: string
  extension?: string | null
  size?: number | null
  webUrl?: string | null
  deletedByName?: string | null
  deletedByEmail?: string | null
  deletedByUsername?: string | null
  deletedAt?: Date
}

const TABLE_NAME = "dbo.TGESTAO_ARQUIVOS_SETOR_LIXEIRA"

export function isSectorFolderTrashTableMissingError(error: unknown) {
  const code = (error as Error & { code?: string })?.code
  return code === "SECTOR_FOLDER_TRASH_TABLE_MISSING"
}

async function ensureSectorFolderTrashTable() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT OBJECT_ID('${TABLE_NAME}', 'U') AS TABLE_ID
  `)

  if (result.recordset[0]?.TABLE_ID) {
    return
  }

  const error = new Error("Tabela de lixeira do gerenciador ausente")
  ;(error as Error & { code?: string }).code =
    "SECTOR_FOLDER_TRASH_TABLE_MISSING"
  throw error
}

export async function listSectorFolderTrashItems(sectorKey: string) {
  await ensureSectorFolderTrashTable()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("SETOR_CHAVE", sql.NVarChar(120), sectorKey)
    .query(`
      SELECT
        ID,
        SHAREPOINT_ITEM_ID,
        SETOR_CHAVE,
        NOME,
        CAMINHO,
        TIPO_ITEM,
        EXTENSAO,
        TAMANHO,
        WEB_URL,
        EXCLUIDO_POR_NOME,
        EXCLUIDO_POR_EMAIL,
        EXCLUIDO_POR_USUARIO,
        EXCLUIDO_EM
      FROM ${TABLE_NAME}
      WHERE SETOR_CHAVE = @SETOR_CHAVE
      ORDER BY EXCLUIDO_EM DESC, NOME
    `)

  return result.recordset as SectorFolderTrashRecord[]
}

export async function getSectorFolderTrashByItemId(itemId: string) {
  await ensureSectorFolderTrashTable()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), itemId)
    .query(`
      SELECT TOP 1
        ID,
        SHAREPOINT_ITEM_ID,
        SETOR_CHAVE,
        NOME,
        CAMINHO,
        TIPO_ITEM,
        EXTENSAO,
        TAMANHO,
        WEB_URL,
        EXCLUIDO_POR_NOME,
        EXCLUIDO_POR_EMAIL,
        EXCLUIDO_POR_USUARIO,
        EXCLUIDO_EM
      FROM ${TABLE_NAME}
      WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
    `)

  return (result.recordset[0] as SectorFolderTrashRecord | undefined) ?? null
}

export async function upsertSectorFolderTrashItem(input: SectorFolderTrashInput) {
  await ensureSectorFolderTrashTable()
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, randomUUID())
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), input.itemId)
    .input("SETOR_CHAVE", sql.NVarChar(120), input.sectorKey)
    .input("NOME", sql.NVarChar(255), input.name)
    .input("CAMINHO", sql.NVarChar(1000), input.path)
    .input("TIPO_ITEM", sql.NVarChar(30), input.itemType)
    .input("EXTENSAO", sql.NVarChar(50), input.extension ?? null)
    .input("TAMANHO", sql.BigInt, input.size ?? null)
    .input("WEB_URL", sql.NVarChar(1200), input.webUrl ?? null)
    .input(
      "EXCLUIDO_POR_NOME",
      sql.NVarChar(255),
      input.deletedByName ?? null,
    )
    .input(
      "EXCLUIDO_POR_EMAIL",
      sql.NVarChar(255),
      input.deletedByEmail ?? null,
    )
    .input(
      "EXCLUIDO_POR_USUARIO",
      sql.NVarChar(255),
      input.deletedByUsername ?? null,
    )
    .input("EXCLUIDO_EM", sql.DateTime2, input.deletedAt ?? new Date())
    .query(`
      IF EXISTS (
        SELECT 1
        FROM ${TABLE_NAME}
        WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
      )
      BEGIN
        UPDATE ${TABLE_NAME}
        SET
          SETOR_CHAVE = @SETOR_CHAVE,
          NOME = @NOME,
          CAMINHO = @CAMINHO,
          TIPO_ITEM = @TIPO_ITEM,
          EXTENSAO = @EXTENSAO,
          TAMANHO = @TAMANHO,
          WEB_URL = @WEB_URL,
          EXCLUIDO_POR_NOME = @EXCLUIDO_POR_NOME,
          EXCLUIDO_POR_EMAIL = @EXCLUIDO_POR_EMAIL,
          EXCLUIDO_POR_USUARIO = @EXCLUIDO_POR_USUARIO,
          EXCLUIDO_EM = @EXCLUIDO_EM
        WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
      END
      ELSE
      BEGIN
        INSERT INTO ${TABLE_NAME} (
          ID,
          SHAREPOINT_ITEM_ID,
          SETOR_CHAVE,
          NOME,
          CAMINHO,
          TIPO_ITEM,
          EXTENSAO,
          TAMANHO,
          WEB_URL,
          EXCLUIDO_POR_NOME,
          EXCLUIDO_POR_EMAIL,
          EXCLUIDO_POR_USUARIO,
          EXCLUIDO_EM
        )
        VALUES (
          @ID,
          @SHAREPOINT_ITEM_ID,
          @SETOR_CHAVE,
          @NOME,
          @CAMINHO,
          @TIPO_ITEM,
          @EXTENSAO,
          @TAMANHO,
          @WEB_URL,
          @EXCLUIDO_POR_NOME,
          @EXCLUIDO_POR_EMAIL,
          @EXCLUIDO_POR_USUARIO,
          @EXCLUIDO_EM
        )
      END
    `)

  return getSectorFolderTrashByItemId(input.itemId)
}

export async function deleteSectorFolderTrashByItemIds(itemIds: string[]) {
  await ensureSectorFolderTrashTable()
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
