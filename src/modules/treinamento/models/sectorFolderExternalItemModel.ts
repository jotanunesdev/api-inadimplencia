import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

const TABLE_NAME = "dbo.TGESTAO_ARQUIVOS_SETOR_LINKS_EXTERNOS"
export const YOUTUBE_EXTERNAL_ITEM_TYPE = "youtube"
export const YOUTUBE_STORED_PATH_PREFIX = "youtube-item:"
const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export type SectorFolderExternalItemRecord = {
  ID: string
  SETOR_CHAVE: string
  PARENT_ITEM_ID: string | null
  NOME_EXIBICAO: string
  CAMINHO: string
  TIPO_LINK: string
  URL: string
  CRIADO_POR_NOME: string | null
  CRIADO_POR_EMAIL: string | null
  CRIADO_POR_USUARIO: string | null
  ATUALIZADO_POR_NOME: string | null
  ATUALIZADO_POR_EMAIL: string | null
  ATUALIZADO_POR_USUARIO: string | null
  CRIADO_EM: Date | null
  ATUALIZADO_EM: Date | null
}

export type SectorFolderExternalItem = {
  id: string
  sectorKey: string
  parentItemId: string | null
  name: string
  path: string
  linkType: string
  url: string
  createdByName: string | null
  createdByEmail: string | null
  createdByUsername: string | null
  updatedByName: string | null
  updatedByEmail: string | null
  updatedByUsername: string | null
  createdAt: Date | null
  updatedAt: Date | null
}

export type CreateSectorFolderExternalItemInput = {
  id?: string
  sectorKey: string
  parentItemId?: string | null
  name: string
  path: string
  linkType: string
  url: string
  createdByName?: string | null
  createdByEmail?: string | null
  createdByUsername?: string | null
  updatedByName?: string | null
  updatedByEmail?: string | null
  updatedByUsername?: string | null
  createdAt?: Date | null
  updatedAt?: Date | null
}

export type UpdateSectorFolderExternalItemInput = {
  itemId: string
  url: string
  updatedByName?: string | null
  updatedByEmail?: string | null
  updatedByUsername?: string | null
  updatedAt?: Date | null
}

function mapExternalItem(
  record: SectorFolderExternalItemRecord | undefined,
): SectorFolderExternalItem | null {
  if (!record) {
    return null
  }

  return {
    id: record.ID,
    sectorKey: record.SETOR_CHAVE,
    parentItemId: record.PARENT_ITEM_ID ?? null,
    name: record.NOME_EXIBICAO,
    path: record.CAMINHO,
    linkType: record.TIPO_LINK,
    url: record.URL,
    createdByName: record.CRIADO_POR_NOME ?? null,
    createdByEmail: record.CRIADO_POR_EMAIL ?? null,
    createdByUsername: record.CRIADO_POR_USUARIO ?? null,
    updatedByName: record.ATUALIZADO_POR_NOME ?? null,
    updatedByEmail: record.ATUALIZADO_POR_EMAIL ?? null,
    updatedByUsername: record.ATUALIZADO_POR_USUARIO ?? null,
    createdAt: record.CRIADO_EM ?? null,
    updatedAt: record.ATUALIZADO_EM ?? null,
  }
}

export function buildYouTubeStoredPathToken(itemId: string) {
  return `${YOUTUBE_STORED_PATH_PREFIX}${String(itemId ?? "").trim()}`
}

export function parseYouTubeStoredPathToken(value: unknown) {
  const normalizedValue = String(value ?? "").trim()
  if (!normalizedValue.startsWith(YOUTUBE_STORED_PATH_PREFIX)) {
    return null
  }

  const itemId = normalizedValue.slice(YOUTUBE_STORED_PATH_PREFIX.length).trim()
  return itemId || null
}

export function isSectorFolderExternalItemTableMissingError(error: unknown) {
  const code = (error as Error & { code?: string })?.code
  return code === "SECTOR_FOLDER_EXTERNAL_ITEM_TABLE_MISSING"
}

async function ensureSectorFolderExternalItemTable() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT OBJECT_ID('${TABLE_NAME}', 'U') AS TABLE_ID
  `)

  if (result.recordset[0]?.TABLE_ID) {
    return
  }

  const error = new Error("Tabela de links externos do gerenciador ausente")
  ;(error as Error & { code?: string }).code =
    "SECTOR_FOLDER_EXTERNAL_ITEM_TABLE_MISSING"
  throw error
}

export async function listSectorFolderExternalItemsByParent(params: {
  sectorKey: string
  parentItemId?: string | null
}) {
  await ensureSectorFolderExternalItemTable()
  const pool = await getPool()
  const request = pool
    .request()
    .input("SETOR_CHAVE", sql.NVarChar(120), params.sectorKey)

  const whereClause =
    params.parentItemId == null
      ? "PARENT_ITEM_ID IS NULL"
      : "PARENT_ITEM_ID = @PARENT_ITEM_ID"

  if (params.parentItemId != null) {
    request.input("PARENT_ITEM_ID", sql.NVarChar(255), params.parentItemId)
  }

  const result = await request.query(`
    SELECT
      ID,
      SETOR_CHAVE,
      PARENT_ITEM_ID,
      NOME_EXIBICAO,
      CAMINHO,
      TIPO_LINK,
      URL,
      CRIADO_POR_NOME,
      CRIADO_POR_EMAIL,
      CRIADO_POR_USUARIO,
      ATUALIZADO_POR_NOME,
      ATUALIZADO_POR_EMAIL,
      ATUALIZADO_POR_USUARIO,
      CRIADO_EM,
      ATUALIZADO_EM
    FROM ${TABLE_NAME}
    WHERE SETOR_CHAVE = @SETOR_CHAVE
      AND ${whereClause}
    ORDER BY NOME_EXIBICAO
  `)

  return (result.recordset as SectorFolderExternalItemRecord[])
    .map((record) => mapExternalItem(record))
    .filter(Boolean) as SectorFolderExternalItem[]
}

export async function listSectorFolderExternalItemsByIds(itemIds: string[]) {
  await ensureSectorFolderExternalItemTable()
  const normalizedIds = Array.from(
    new Set(
      itemIds
        .map((itemId) => String(itemId ?? "").trim())
        .filter((itemId) => GUID_REGEX.test(itemId)),
    ),
  )

  if (normalizedIds.length === 0) {
    return [] as SectorFolderExternalItem[]
  }

  const pool = await getPool()
  const request = pool.request()
  const idParameters = normalizedIds.map((itemId, index) => {
    const inputName = `ID_${index}`
    request.input(inputName, sql.UniqueIdentifier, itemId)
    return `@${inputName}`
  })

  const result = await request.query(`
    SELECT
      ID,
      SETOR_CHAVE,
      PARENT_ITEM_ID,
      NOME_EXIBICAO,
      CAMINHO,
      TIPO_LINK,
      URL,
      CRIADO_POR_NOME,
      CRIADO_POR_EMAIL,
      CRIADO_POR_USUARIO,
      ATUALIZADO_POR_NOME,
      ATUALIZADO_POR_EMAIL,
      ATUALIZADO_POR_USUARIO,
      CRIADO_EM,
      ATUALIZADO_EM
    FROM ${TABLE_NAME}
    WHERE ID IN (${idParameters.join(", ")})
  `)

  return (result.recordset as SectorFolderExternalItemRecord[])
    .map((record) => mapExternalItem(record))
    .filter(Boolean) as SectorFolderExternalItem[]
}

export async function getSectorFolderExternalItemById(itemId: string) {
  await ensureSectorFolderExternalItemTable()
  if (!GUID_REGEX.test(String(itemId ?? "").trim())) {
    return null
  }

  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, itemId)
    .query(`
      SELECT TOP 1
        ID,
        SETOR_CHAVE,
        PARENT_ITEM_ID,
        NOME_EXIBICAO,
        CAMINHO,
        TIPO_LINK,
        URL,
        CRIADO_POR_NOME,
        CRIADO_POR_EMAIL,
        CRIADO_POR_USUARIO,
        ATUALIZADO_POR_NOME,
        ATUALIZADO_POR_EMAIL,
        ATUALIZADO_POR_USUARIO,
        CRIADO_EM,
        ATUALIZADO_EM
      FROM ${TABLE_NAME}
      WHERE ID = @ID
    `)

  return mapExternalItem(
    result.recordset[0] as SectorFolderExternalItemRecord | undefined,
  )
}

export async function listSectorFolderExternalItemsByPathPrefix(params: {
  sectorKey: string
  pathPrefix: string
}) {
  await ensureSectorFolderExternalItemTable()
  const normalizedPrefix = String(params.pathPrefix ?? "").trim()
  if (!normalizedPrefix) {
    return [] as SectorFolderExternalItem[]
  }

  const pool = await getPool()
  const result = await pool
    .request()
    .input("SETOR_CHAVE", sql.NVarChar(120), params.sectorKey)
    .input("CAMINHO", sql.NVarChar(1000), normalizedPrefix)
    .query(`
      SELECT
        ID,
        SETOR_CHAVE,
        PARENT_ITEM_ID,
        NOME_EXIBICAO,
        CAMINHO,
        TIPO_LINK,
        URL,
        CRIADO_POR_NOME,
        CRIADO_POR_EMAIL,
        CRIADO_POR_USUARIO,
        ATUALIZADO_POR_NOME,
        ATUALIZADO_POR_EMAIL,
        ATUALIZADO_POR_USUARIO,
        CRIADO_EM,
        ATUALIZADO_EM
      FROM ${TABLE_NAME}
      WHERE SETOR_CHAVE = @SETOR_CHAVE
        AND (
          CAMINHO = @CAMINHO OR
          LEFT(CAMINHO, LEN(@CAMINHO) + 1) = @CAMINHO + '/'
        )
      ORDER BY CAMINHO, NOME_EXIBICAO
    `)

  return (result.recordset as SectorFolderExternalItemRecord[])
    .map((record) => mapExternalItem(record))
    .filter(Boolean) as SectorFolderExternalItem[]
}

export async function createSectorFolderExternalItem(
  input: CreateSectorFolderExternalItemInput,
) {
  await ensureSectorFolderExternalItemTable()
  const itemId = input.id ?? randomUUID()
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, itemId)
    .input("SETOR_CHAVE", sql.NVarChar(120), input.sectorKey)
    .input("PARENT_ITEM_ID", sql.NVarChar(255), input.parentItemId ?? null)
    .input("NOME_EXIBICAO", sql.NVarChar(255), input.name)
    .input("CAMINHO", sql.NVarChar(1000), input.path)
    .input("TIPO_LINK", sql.VarChar(30), input.linkType)
    .input("URL", sql.NVarChar(1200), input.url)
    .input("CRIADO_POR_NOME", sql.NVarChar(255), input.createdByName ?? null)
    .input("CRIADO_POR_EMAIL", sql.NVarChar(255), input.createdByEmail ?? null)
    .input(
      "CRIADO_POR_USUARIO",
      sql.NVarChar(255),
      input.createdByUsername ?? null,
    )
    .input(
      "ATUALIZADO_POR_NOME",
      sql.NVarChar(255),
      input.updatedByName ?? null,
    )
    .input(
      "ATUALIZADO_POR_EMAIL",
      sql.NVarChar(255),
      input.updatedByEmail ?? null,
    )
    .input(
      "ATUALIZADO_POR_USUARIO",
      sql.NVarChar(255),
      input.updatedByUsername ?? null,
    )
    .input("CRIADO_EM", sql.DateTime2, input.createdAt ?? new Date())
    .input("ATUALIZADO_EM", sql.DateTime2, input.updatedAt ?? new Date())
    .query(`
      INSERT INTO ${TABLE_NAME} (
        ID,
        SETOR_CHAVE,
        PARENT_ITEM_ID,
        NOME_EXIBICAO,
        CAMINHO,
        TIPO_LINK,
        URL,
        CRIADO_POR_NOME,
        CRIADO_POR_EMAIL,
        CRIADO_POR_USUARIO,
        ATUALIZADO_POR_NOME,
        ATUALIZADO_POR_EMAIL,
        ATUALIZADO_POR_USUARIO,
        CRIADO_EM,
        ATUALIZADO_EM
      )
      VALUES (
        @ID,
        @SETOR_CHAVE,
        @PARENT_ITEM_ID,
        @NOME_EXIBICAO,
        @CAMINHO,
        @TIPO_LINK,
        @URL,
        @CRIADO_POR_NOME,
        @CRIADO_POR_EMAIL,
        @CRIADO_POR_USUARIO,
        @ATUALIZADO_POR_NOME,
        @ATUALIZADO_POR_EMAIL,
        @ATUALIZADO_POR_USUARIO,
        @CRIADO_EM,
        @ATUALIZADO_EM
      )
    `)

  return getSectorFolderExternalItemById(itemId)
}

export async function updateSectorFolderExternalItem(
  input: UpdateSectorFolderExternalItemInput,
) {
  await ensureSectorFolderExternalItemTable()
  if (!GUID_REGEX.test(String(input.itemId ?? "").trim())) {
    return null
  }

  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.itemId)
    .input("URL", sql.NVarChar(1200), input.url)
    .input(
      "ATUALIZADO_POR_NOME",
      sql.NVarChar(255),
      input.updatedByName ?? null,
    )
    .input(
      "ATUALIZADO_POR_EMAIL",
      sql.NVarChar(255),
      input.updatedByEmail ?? null,
    )
    .input(
      "ATUALIZADO_POR_USUARIO",
      sql.NVarChar(255),
      input.updatedByUsername ?? null,
    )
    .input("ATUALIZADO_EM", sql.DateTime2, input.updatedAt ?? new Date())
    .query(`
      UPDATE ${TABLE_NAME}
      SET
        URL = @URL,
        ATUALIZADO_POR_NOME = @ATUALIZADO_POR_NOME,
        ATUALIZADO_POR_EMAIL = @ATUALIZADO_POR_EMAIL,
        ATUALIZADO_POR_USUARIO = @ATUALIZADO_POR_USUARIO,
        ATUALIZADO_EM = @ATUALIZADO_EM
      WHERE ID = @ID
    `)

  return getSectorFolderExternalItemById(input.itemId)
}

export async function updateSectorFolderExternalItemPathsByPrefix(params: {
  sectorKey: string
  oldPathPrefix: string
  newPathPrefix: string
}) {
  await ensureSectorFolderExternalItemTable()
  const oldPathPrefix = String(params.oldPathPrefix ?? "").trim()
  const newPathPrefix = String(params.newPathPrefix ?? "").trim()

  if (!oldPathPrefix || !newPathPrefix || oldPathPrefix === newPathPrefix) {
    return
  }

  const pool = await getPool()
  await pool
    .request()
    .input("SETOR_CHAVE", sql.NVarChar(120), params.sectorKey)
    .input("OLD", sql.NVarChar(1000), oldPathPrefix)
    .input("NEW", sql.NVarChar(1000), newPathPrefix)
    .query(`
      UPDATE ${TABLE_NAME}
      SET
        CAMINHO = @NEW + SUBSTRING(CAMINHO, LEN(@OLD) + 1, 1000),
        ATUALIZADO_EM = SYSUTCDATETIME()
      WHERE SETOR_CHAVE = @SETOR_CHAVE
        AND LEFT(CAMINHO, LEN(@OLD) + 1) = @OLD + '/'
    `)
}

export async function deleteSectorFolderExternalItemsByIds(itemIds: string[]) {
  await ensureSectorFolderExternalItemTable()
  const normalizedIds = Array.from(
    new Set(
      itemIds
        .map((itemId) => String(itemId ?? "").trim())
        .filter((itemId) => GUID_REGEX.test(itemId)),
    ),
  )
  if (normalizedIds.length === 0) {
    return
  }

  const pool = await getPool()
  const request = pool.request()
  const idParameters = normalizedIds.map((itemId, index) => {
    const inputName = `ID_${index}`
    request.input(inputName, sql.UniqueIdentifier, itemId)
    return `@${inputName}`
  })

  await request.query(`
    DELETE FROM ${TABLE_NAME}
    WHERE ID IN (${idParameters.join(", ")})
  `)
}
