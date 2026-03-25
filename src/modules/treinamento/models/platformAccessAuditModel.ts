import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

type PlatformAccessAuditRecord = {
  ID: string
  USUARIO_USERNAME: string
  USUARIO_NOME: string | null
  USUARIO_EMAIL: string | null
  USUARIO_SETOR: string | null
  ACESSADO_EM: Date
}

export type PlatformAccessAuditItem = {
  accessedAt: string
  department: string | null
  displayName: string | null
  email: string | null
  id: string
  userLabel: string
  username: string
}

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

let ensurePlatformAccessAuditSchemaPromise: Promise<void> | null = null

const normalizeUsernameValue = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.trim() ?? ""

const normalizeOptionalValue = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim()
  return normalizedValue || null
}

function normalizeLimit(value: number | null | undefined) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.trunc(parsed), MAX_LIMIT)
}

async function ensurePlatformAccessAuditSchema() {
  if (!ensurePlatformAccessAuditSchemaPromise) {
    ensurePlatformAccessAuditSchemaPromise = (async () => {
      const pool = await getPool()
      await pool.request().query(`
        IF OBJECT_ID('dbo.TPLATAFORMA_ACESSOS_AUDITORIA', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TPLATAFORMA_ACESSOS_AUDITORIA (
            ID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
            USUARIO_USERNAME VARCHAR(255) NOT NULL,
            USUARIO_NOME NVARCHAR(255) NULL,
            USUARIO_EMAIL VARCHAR(255) NULL,
            USUARIO_SETOR NVARCHAR(255) NULL,
            ACESSADO_EM DATETIME2 NOT NULL
          )
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TPLATAFORMA_ACESSOS_AUDITORIA')
            AND name = 'IX_TPLATAFORMA_ACESSOS_AUDITORIA_ACESSADO_EM'
        )
        BEGIN
          CREATE INDEX IX_TPLATAFORMA_ACESSOS_AUDITORIA_ACESSADO_EM
            ON dbo.TPLATAFORMA_ACESSOS_AUDITORIA (ACESSADO_EM DESC)
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TPLATAFORMA_ACESSOS_AUDITORIA')
            AND name = 'IX_TPLATAFORMA_ACESSOS_AUDITORIA_USERNAME'
        )
        BEGIN
          CREATE INDEX IX_TPLATAFORMA_ACESSOS_AUDITORIA_USERNAME
            ON dbo.TPLATAFORMA_ACESSOS_AUDITORIA (USUARIO_USERNAME, ACESSADO_EM DESC)
        END
      `)
    })().finally(() => {
      ensurePlatformAccessAuditSchemaPromise = null
    })
  }

  await ensurePlatformAccessAuditSchemaPromise
}

function mapPlatformAccessAuditRecord(
  record: PlatformAccessAuditRecord,
): PlatformAccessAuditItem {
  const username = normalizeUsernameValue(record.USUARIO_USERNAME)
  const displayName = normalizeOptionalValue(record.USUARIO_NOME)
  const email = normalizeOptionalValue(record.USUARIO_EMAIL)

  return {
    accessedAt: new Date(record.ACESSADO_EM).toISOString(),
    department: normalizeOptionalValue(record.USUARIO_SETOR),
    displayName,
    email,
    id: record.ID,
    userLabel: displayName ?? username ?? email ?? "Usuario nao identificado",
    username,
  }
}

export async function createPlatformAccessAuditEntry(input: {
  accessedAt?: Date | null
  department?: string | null
  displayName?: string | null
  email?: string | null
  username: string
}) {
  await ensurePlatformAccessAuditSchema()

  const username = normalizeUsernameValue(input.username)
  const displayName = normalizeOptionalValue(input.displayName)
  const email = normalizeOptionalValue(input.email)
  const department = normalizeOptionalValue(input.department)
  const accessedAt = input.accessedAt ?? new Date()

  if (!username) {
    throw new Error("PLATFORM_ACCESS_AUDIT_USERNAME_REQUIRED")
  }

  const pool = await getPool()
  const id = randomUUID()

  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("USUARIO_USERNAME", sql.VarChar(255), username)
    .input("USUARIO_NOME", sql.NVarChar(255), displayName)
    .input("USUARIO_EMAIL", sql.VarChar(255), email)
    .input("USUARIO_SETOR", sql.NVarChar(255), department)
    .input("ACESSADO_EM", sql.DateTime2, accessedAt)
    .query(`
      INSERT INTO dbo.TPLATAFORMA_ACESSOS_AUDITORIA (
        ID,
        USUARIO_USERNAME,
        USUARIO_NOME,
        USUARIO_EMAIL,
        USUARIO_SETOR,
        ACESSADO_EM
      )
      VALUES (
        @ID,
        @USUARIO_USERNAME,
        @USUARIO_NOME,
        @USUARIO_EMAIL,
        @USUARIO_SETOR,
        @ACESSADO_EM
      )
    `)

  return mapPlatformAccessAuditRecord({
    ID: id,
    USUARIO_USERNAME: username,
    USUARIO_NOME: displayName,
    USUARIO_EMAIL: email,
    USUARIO_SETOR: department,
    ACESSADO_EM: accessedAt,
  })
}

export async function listPlatformAccessAuditEntries(limit?: number | null) {
  await ensurePlatformAccessAuditSchema()

  const normalizedLimit = normalizeLimit(limit)
  const pool = await getPool()
  const result = await pool
    .request()
    .input("LIMIT", sql.Int, normalizedLimit)
    .query(`
      SELECT TOP (@LIMIT)
        ID,
        USUARIO_USERNAME,
        USUARIO_NOME,
        USUARIO_EMAIL,
        USUARIO_SETOR,
        ACESSADO_EM
      FROM dbo.TPLATAFORMA_ACESSOS_AUDITORIA
      ORDER BY ACESSADO_EM DESC
    `)

  return (result.recordset as PlatformAccessAuditRecord[]).map(
    mapPlatformAccessAuditRecord,
  )
}
