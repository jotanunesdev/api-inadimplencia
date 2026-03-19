import { getPool, sql } from "../config/db"

const TABLE_NAME = "dbo.TGESTAO_ARQUIVOS_SETOR_PASTAS"

export type SectorFolderMetadataRecord = {
  SHAREPOINT_ITEM_ID: string
  SETOR: string
  NOME: string
  CAMINHO: string
  CRIADO_POR_NOME: string | null
  CRIADO_POR_EMAIL: string | null
  CRIADO_POR_USUARIO: string | null
  ATUALIZADO_POR_NOME: string | null
  ATUALIZADO_POR_EMAIL: string | null
  ATUALIZADO_POR_USUARIO: string | null
  CRIADO_EM: Date | null
  ATUALIZADO_EM: Date | null
  VALIDADE_MESES?: number | null
  VALIDADE_ANOS?: number | null
}

export type SectorFolderMetadata = {
  itemId: string
  sector: string
  name: string
  path: string
  createdByName: string | null
  createdByEmail: string | null
  createdByUsername: string | null
  updatedByName: string | null
  updatedByEmail: string | null
  updatedByUsername: string | null
  createdAt: Date | null
  updatedAt: Date | null
  validityMonths: number | null
  validityYears: number | null
}

export type SectorFolderMetadataInput = {
  itemId: string
  sector: string
  name: string
  path: string
  createdByName?: string | null
  createdByEmail?: string | null
  createdByUsername?: string | null
  updatedByName?: string | null
  updatedByEmail?: string | null
  updatedByUsername?: string | null
  createdAt?: Date | null
  updatedAt?: Date | null
  validityMonths?: number | null
  validityYears?: number | null
}

function mapSectorFolderMetadata(
  record: SectorFolderMetadataRecord | undefined,
): SectorFolderMetadata | null {
  if (!record) {
    return null
  }

  return {
    itemId: record.SHAREPOINT_ITEM_ID,
    sector: record.SETOR,
    name: record.NOME,
    path: record.CAMINHO,
    createdByName: record.CRIADO_POR_NOME,
    createdByEmail: record.CRIADO_POR_EMAIL,
    createdByUsername: record.CRIADO_POR_USUARIO,
    updatedByName: record.ATUALIZADO_POR_NOME,
    updatedByEmail: record.ATUALIZADO_POR_EMAIL,
    updatedByUsername: record.ATUALIZADO_POR_USUARIO,
    createdAt: record.CRIADO_EM ?? null,
    updatedAt: record.ATUALIZADO_EM ?? null,
    validityMonths:
      record.VALIDADE_MESES === undefined || record.VALIDADE_MESES === null
        ? null
        : Number(record.VALIDADE_MESES),
    validityYears:
      record.VALIDADE_ANOS === undefined || record.VALIDADE_ANOS === null
        ? null
        : Number(record.VALIDADE_ANOS),
  }
}

export function isSectorFolderMetadataSchemaMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  return (
    normalized.includes("invalid object name") &&
    normalized.includes("tgestao_arquivos_setor_pastas")
  )
}

function isSectorFolderMetadataValidityColumnsMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  return (
    normalized.includes("invalid column name") &&
    (normalized.includes("validade_meses") ||
      normalized.includes("validade_anos"))
  )
}

const BASE_METADATA_SELECT = `
  SHAREPOINT_ITEM_ID,
  SETOR,
  NOME,
  CAMINHO,
  CRIADO_POR_NOME,
  CRIADO_POR_EMAIL,
  CRIADO_POR_USUARIO,
  ATUALIZADO_POR_NOME,
  ATUALIZADO_POR_EMAIL,
  ATUALIZADO_POR_USUARIO,
  CRIADO_EM,
  ATUALIZADO_EM
`

const EXTENDED_METADATA_SELECT = `
  ${BASE_METADATA_SELECT},
  VALIDADE_MESES,
  VALIDADE_ANOS
`

async function queryMetadataBySector(
  sector: string,
  includeValidityColumns: boolean,
) {
  const pool = await getPool()
  return pool
    .request()
    .input("SETOR", sql.NVarChar(120), sector)
    .query(
      `
        SELECT
          ${includeValidityColumns ? EXTENDED_METADATA_SELECT : BASE_METADATA_SELECT}
        FROM ${TABLE_NAME}
        WHERE SETOR = @SETOR
        ORDER BY NOME
      `,
    )
}

async function queryMetadataByItemId(
  itemId: string,
  includeValidityColumns: boolean,
) {
  const pool = await getPool()
  return pool
    .request()
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), itemId)
    .query(
      `
        SELECT TOP 1
          ${includeValidityColumns ? EXTENDED_METADATA_SELECT : BASE_METADATA_SELECT}
        FROM ${TABLE_NAME}
        WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
      `,
    )
}

export async function listSectorFolderMetadataBySector(sector: string) {
  let result

  try {
    result = await queryMetadataBySector(sector, true)
  } catch (error) {
    if (!isSectorFolderMetadataValidityColumnsMissingError(error)) {
      throw error
    }

    result = await queryMetadataBySector(sector, false)
  }

  return (result.recordset as SectorFolderMetadataRecord[]).map((record) =>
    mapSectorFolderMetadata(record),
  ) as SectorFolderMetadata[]
}

export async function getSectorFolderMetadataByItemId(itemId: string) {
  let result

  try {
    result = await queryMetadataByItemId(itemId, true)
  } catch (error) {
    if (!isSectorFolderMetadataValidityColumnsMissingError(error)) {
      throw error
    }

    result = await queryMetadataByItemId(itemId, false)
  }

  return mapSectorFolderMetadata(result.recordset[0] as SectorFolderMetadataRecord)
}

export async function upsertSectorFolderMetadata(input: SectorFolderMetadataInput) {
  const pool = await getPool()
  const request = pool
    .request()
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), input.itemId)
    .input("SETOR", sql.NVarChar(120), input.sector)
    .input("NOME", sql.NVarChar(255), input.name)
    .input("CAMINHO", sql.NVarChar(1000), input.path)
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
    .input("CRIADO_EM", sql.DateTime2, input.createdAt ?? null)
    .input("ATUALIZADO_EM", sql.DateTime2, input.updatedAt ?? null)
    .input("VALIDADE_MESES", sql.TinyInt, input.validityMonths ?? null)
    .input("VALIDADE_ANOS", sql.TinyInt, input.validityYears ?? null)

  try {
    await request.query(
      `
        IF EXISTS (
          SELECT 1
          FROM ${TABLE_NAME}
          WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
        )
        BEGIN
          UPDATE ${TABLE_NAME}
          SET
            SETOR = @SETOR,
            NOME = @NOME,
            CAMINHO = @CAMINHO,
            ATUALIZADO_POR_NOME = COALESCE(@ATUALIZADO_POR_NOME, ATUALIZADO_POR_NOME),
            ATUALIZADO_POR_EMAIL = COALESCE(@ATUALIZADO_POR_EMAIL, ATUALIZADO_POR_EMAIL),
            ATUALIZADO_POR_USUARIO = COALESCE(@ATUALIZADO_POR_USUARIO, ATUALIZADO_POR_USUARIO),
            ATUALIZADO_EM = COALESCE(@ATUALIZADO_EM, SYSUTCDATETIME()),
            CRIADO_POR_NOME = COALESCE(CRIADO_POR_NOME, @CRIADO_POR_NOME),
            CRIADO_POR_EMAIL = COALESCE(CRIADO_POR_EMAIL, @CRIADO_POR_EMAIL),
            CRIADO_POR_USUARIO = COALESCE(CRIADO_POR_USUARIO, @CRIADO_POR_USUARIO),
            CRIADO_EM = COALESCE(CRIADO_EM, @CRIADO_EM, SYSUTCDATETIME()),
            VALIDADE_MESES = @VALIDADE_MESES,
            VALIDADE_ANOS = @VALIDADE_ANOS
          WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
        END
        ELSE
        BEGIN
          INSERT INTO ${TABLE_NAME} (
            SHAREPOINT_ITEM_ID,
            SETOR,
            NOME,
            CAMINHO,
            CRIADO_POR_NOME,
            CRIADO_POR_EMAIL,
            CRIADO_POR_USUARIO,
            ATUALIZADO_POR_NOME,
            ATUALIZADO_POR_EMAIL,
            ATUALIZADO_POR_USUARIO,
            CRIADO_EM,
            ATUALIZADO_EM,
            VALIDADE_MESES,
            VALIDADE_ANOS
          )
          VALUES (
            @SHAREPOINT_ITEM_ID,
            @SETOR,
            @NOME,
            @CAMINHO,
            @CRIADO_POR_NOME,
            @CRIADO_POR_EMAIL,
            @CRIADO_POR_USUARIO,
            @ATUALIZADO_POR_NOME,
            @ATUALIZADO_POR_EMAIL,
            @ATUALIZADO_POR_USUARIO,
            COALESCE(@CRIADO_EM, SYSUTCDATETIME()),
            COALESCE(@ATUALIZADO_EM, SYSUTCDATETIME()),
            @VALIDADE_MESES,
            @VALIDADE_ANOS
          )
        END
      `,
    )
  } catch (error) {
    if (!isSectorFolderMetadataValidityColumnsMissingError(error)) {
      throw error
    }

    const hasValidityInput =
      input.validityMonths != null || input.validityYears != null

    if (hasValidityInput) {
      throw new Error(
        "A migration de validade do gerenciador de arquivos precisa ser aplicada antes de cadastrar arquivos na pasta Normas.",
      )
    }

    await pool
      .request()
      .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), input.itemId)
      .input("SETOR", sql.NVarChar(120), input.sector)
      .input("NOME", sql.NVarChar(255), input.name)
      .input("CAMINHO", sql.NVarChar(1000), input.path)
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
      .input("CRIADO_EM", sql.DateTime2, input.createdAt ?? null)
      .input("ATUALIZADO_EM", sql.DateTime2, input.updatedAt ?? null)
      .query(
        `
          IF EXISTS (
            SELECT 1
            FROM ${TABLE_NAME}
            WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
          )
          BEGIN
            UPDATE ${TABLE_NAME}
            SET
              SETOR = @SETOR,
              NOME = @NOME,
              CAMINHO = @CAMINHO,
              ATUALIZADO_POR_NOME = COALESCE(@ATUALIZADO_POR_NOME, ATUALIZADO_POR_NOME),
              ATUALIZADO_POR_EMAIL = COALESCE(@ATUALIZADO_POR_EMAIL, ATUALIZADO_POR_EMAIL),
              ATUALIZADO_POR_USUARIO = COALESCE(@ATUALIZADO_POR_USUARIO, ATUALIZADO_POR_USUARIO),
              ATUALIZADO_EM = COALESCE(@ATUALIZADO_EM, SYSUTCDATETIME()),
              CRIADO_POR_NOME = COALESCE(CRIADO_POR_NOME, @CRIADO_POR_NOME),
              CRIADO_POR_EMAIL = COALESCE(CRIADO_POR_EMAIL, @CRIADO_POR_EMAIL),
              CRIADO_POR_USUARIO = COALESCE(CRIADO_POR_USUARIO, @CRIADO_POR_USUARIO),
              CRIADO_EM = COALESCE(CRIADO_EM, @CRIADO_EM, SYSUTCDATETIME())
            WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
          END
          ELSE
          BEGIN
            INSERT INTO ${TABLE_NAME} (
              SHAREPOINT_ITEM_ID,
              SETOR,
              NOME,
              CAMINHO,
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
              @SHAREPOINT_ITEM_ID,
              @SETOR,
              @NOME,
              @CAMINHO,
              @CRIADO_POR_NOME,
              @CRIADO_POR_EMAIL,
              @CRIADO_POR_USUARIO,
              @ATUALIZADO_POR_NOME,
              @ATUALIZADO_POR_EMAIL,
              @ATUALIZADO_POR_USUARIO,
              COALESCE(@CRIADO_EM, SYSUTCDATETIME()),
              COALESCE(@ATUALIZADO_EM, SYSUTCDATETIME())
            )
          END
        `,
      )
  }

  return getSectorFolderMetadataByItemId(input.itemId)
}

export async function deleteSectorFolderMetadataByItemId(itemId: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("SHAREPOINT_ITEM_ID", sql.NVarChar(255), itemId)
    .query(`DELETE FROM ${TABLE_NAME} WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID`)
}
