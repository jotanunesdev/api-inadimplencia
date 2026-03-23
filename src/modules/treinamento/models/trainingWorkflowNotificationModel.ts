import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"
import { normalizeUsernameValue } from "../utils/sectorAccess"

export type TrainingWorkflowNotificationStatusFilter =
  | "pendente"
  | "lida"
  | "todas"

export type TrainingWorkflowNotificationType =
  | "training_pending_efficacy"
  | "training_ready_assignment"

type TrainingWorkflowNotificationRecord = {
  ID: string
  USERNAME: string
  TIPO: TrainingWorkflowNotificationType
  TRILHA_ID: string
  TRILHA_TITULO: string | null
  MODULO_ID: string | null
  SETOR_ORIGEM_CHAVE: string | null
  SETOR_ORIGEM_LABEL: string | null
  SETOR_DESTINO_CHAVE: string | null
  AUTOR_USERNAME: string | null
  AUTOR_NOME: string | null
  CRIADO_EM: Date
  LIDA_EM: Date | null
}

export type TrainingWorkflowNotificationItem = {
  id: string
  username: string
  type: TrainingWorkflowNotificationType
  trainingId: string
  trainingTitle: string | null
  moduleId: string | null
  sourceSectorKey: string | null
  sourceSectorLabel: string | null
  destinationSectorKey: string | null
  authorUsername: string | null
  authorName: string | null
  createdAt: string
  readAt: string | null
}

export type TrainingWorkflowNotificationSnapshot = {
  generatedAt: string
  notifications: TrainingWorkflowNotificationItem[]
  unreadCount: number
  username: string
}

const DEFAULT_NOTIFICATION_LIMIT = 10
const MAX_NOTIFICATION_LIMIT = 50
let ensureTrainingWorkflowNotificationSchemaPromise: Promise<void> | null = null

async function ensureTrainingWorkflowNotificationSchema() {
  if (!ensureTrainingWorkflowNotificationSchemaPromise) {
    ensureTrainingWorkflowNotificationSchemaPromise = (async () => {
      const pool = await getPool()
      await pool.request().query(`
        IF OBJECT_ID('dbo.TTREINAMENTO_NOTIFICACOES_FLUXO', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TTREINAMENTO_NOTIFICACOES_FLUXO (
            ID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
            USERNAME VARCHAR(255) NOT NULL,
            TIPO VARCHAR(40) NOT NULL,
            TRILHA_ID UNIQUEIDENTIFIER NOT NULL,
            TRILHA_TITULO NVARCHAR(255) NULL,
            MODULO_ID UNIQUEIDENTIFIER NULL,
            SETOR_ORIGEM_CHAVE VARCHAR(120) NULL,
            SETOR_ORIGEM_LABEL NVARCHAR(120) NULL,
            SETOR_DESTINO_CHAVE VARCHAR(120) NULL,
            AUTOR_USERNAME VARCHAR(255) NULL,
            AUTOR_NOME NVARCHAR(255) NULL,
            CRIADO_EM DATETIME2 NOT NULL,
            LIDA_EM DATETIME2 NULL
          )
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TTREINAMENTO_NOTIFICACOES_FLUXO')
            AND name = 'UX_TTREINAMENTO_NOTIFICACOES_FLUXO_EVENT'
        )
        BEGIN
          CREATE UNIQUE INDEX UX_TTREINAMENTO_NOTIFICACOES_FLUXO_EVENT
            ON dbo.TTREINAMENTO_NOTIFICACOES_FLUXO (USERNAME, TIPO, TRILHA_ID)
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TTREINAMENTO_NOTIFICACOES_FLUXO')
            AND name = 'IX_TTREINAMENTO_NOTIFICACOES_FLUXO_USER_CREATED'
        )
        BEGIN
          CREATE INDEX IX_TTREINAMENTO_NOTIFICACOES_FLUXO_USER_CREATED
            ON dbo.TTREINAMENTO_NOTIFICACOES_FLUXO (USERNAME, CRIADO_EM)
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TTREINAMENTO_NOTIFICACOES_FLUXO')
            AND name = 'IX_TTREINAMENTO_NOTIFICACOES_FLUXO_USER_READ'
        )
        BEGIN
          CREATE INDEX IX_TTREINAMENTO_NOTIFICACOES_FLUXO_USER_READ
            ON dbo.TTREINAMENTO_NOTIFICACOES_FLUXO (USERNAME, LIDA_EM, CRIADO_EM)
        END
      `)
    })().finally(() => {
      ensureTrainingWorkflowNotificationSchemaPromise = null
    })
  }

  await ensureTrainingWorkflowNotificationSchemaPromise
}

function normalizeLimit(value: number | null | undefined) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_NOTIFICATION_LIMIT
  }

  return Math.min(Math.trunc(parsed), MAX_NOTIFICATION_LIMIT)
}

function mapTrainingWorkflowNotificationRecord(
  record: TrainingWorkflowNotificationRecord,
): TrainingWorkflowNotificationItem {
  return {
    id: record.ID,
    username: normalizeUsernameValue(record.USERNAME),
    type: record.TIPO,
    trainingId: record.TRILHA_ID,
    trainingTitle: record.TRILHA_TITULO,
    moduleId: record.MODULO_ID,
    sourceSectorKey: record.SETOR_ORIGEM_CHAVE,
    sourceSectorLabel: record.SETOR_ORIGEM_LABEL,
    destinationSectorKey: record.SETOR_DESTINO_CHAVE,
    authorUsername: record.AUTOR_USERNAME
      ? normalizeUsernameValue(record.AUTOR_USERNAME)
      : null,
    authorName: record.AUTOR_NOME,
    createdAt: new Date(record.CRIADO_EM).toISOString(),
    readAt: record.LIDA_EM ? new Date(record.LIDA_EM).toISOString() : null,
  }
}

export async function listTrainingWorkflowNotifications(params: {
  username: string
  status?: TrainingWorkflowNotificationStatusFilter
  limit?: number | null
}) {
  await ensureTrainingWorkflowNotificationSchema()

  const username = normalizeUsernameValue(params.username)
  const status = params.status ?? "todas"
  const limit = normalizeLimit(params.limit)

  let statusClause = ""
  if (status === "pendente") {
    statusClause = "AND LIDA_EM IS NULL"
  } else if (status === "lida") {
    statusClause = "AND LIDA_EM IS NOT NULL"
  }

  const pool = await getPool()
  const result = await pool
    .request()
    .input("USERNAME", sql.VarChar(255), username)
    .input("LIMIT", sql.Int, limit)
    .query(`
      SELECT TOP (@LIMIT)
        ID,
        USERNAME,
        TIPO,
        TRILHA_ID,
        TRILHA_TITULO,
        MODULO_ID,
        SETOR_ORIGEM_CHAVE,
        SETOR_ORIGEM_LABEL,
        SETOR_DESTINO_CHAVE,
        AUTOR_USERNAME,
        AUTOR_NOME,
        CRIADO_EM,
        LIDA_EM
      FROM dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
      WHERE USERNAME = @USERNAME
      ${statusClause}
      ORDER BY
        CASE WHEN LIDA_EM IS NULL THEN 0 ELSE 1 END,
        CRIADO_EM DESC,
        ID DESC
    `)

  return (result.recordset as TrainingWorkflowNotificationRecord[]).map(
    mapTrainingWorkflowNotificationRecord,
  )
}

export async function countUnreadTrainingWorkflowNotifications(username: string) {
  await ensureTrainingWorkflowNotificationSchema()

  const normalizedUsername = normalizeUsernameValue(username)
  const pool = await getPool()
  const result = await pool
    .request()
    .input("USERNAME", sql.VarChar(255), normalizedUsername)
    .query(`
      SELECT COUNT(1) AS TOTAL
      FROM dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
      WHERE USERNAME = @USERNAME
        AND LIDA_EM IS NULL
    `)

  return Number(result.recordset[0]?.TOTAL ?? 0)
}

export async function getTrainingWorkflowNotificationSnapshot(params: {
  username: string
  status?: TrainingWorkflowNotificationStatusFilter
  limit?: number | null
}): Promise<TrainingWorkflowNotificationSnapshot> {
  const username = normalizeUsernameValue(params.username)
  const [notifications, unreadCount] = await Promise.all([
    listTrainingWorkflowNotifications(params),
    countUnreadTrainingWorkflowNotifications(username),
  ])

  return {
    generatedAt: new Date().toISOString(),
    notifications,
    unreadCount,
    username,
  }
}

export async function createTrainingWorkflowNotification(input: {
  recipientUsername: string
  type: TrainingWorkflowNotificationType
  trainingId: string
  trainingTitle?: string | null
  moduleId?: string | null
  sourceSectorKey?: string | null
  sourceSectorLabel?: string | null
  destinationSectorKey?: string | null
  authorUsername?: string | null
  authorName?: string | null
}) {
  await ensureTrainingWorkflowNotificationSchema()

  const recipientUsername = normalizeUsernameValue(input.recipientUsername)
  const trainingId = String(input.trainingId ?? "").trim()

  if (!recipientUsername || !trainingId) {
    return null
  }

  const id = randomUUID()
  const createdAt = new Date()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("USERNAME", sql.VarChar(255), recipientUsername)
    .input("TIPO", sql.VarChar(40), input.type)
    .input("TRILHA_ID", sql.UniqueIdentifier, trainingId)
    .input(
      "TRILHA_TITULO",
      sql.NVarChar(255),
      String(input.trainingTitle ?? "").trim() || null,
    )
    .input("MODULO_ID", sql.UniqueIdentifier, input.moduleId ?? null)
    .input(
      "SETOR_ORIGEM_CHAVE",
      sql.VarChar(120),
      String(input.sourceSectorKey ?? "").trim() || null,
    )
    .input(
      "SETOR_ORIGEM_LABEL",
      sql.NVarChar(120),
      String(input.sourceSectorLabel ?? "").trim() || null,
    )
    .input(
      "SETOR_DESTINO_CHAVE",
      sql.VarChar(120),
      String(input.destinationSectorKey ?? "").trim() || null,
    )
    .input(
      "AUTOR_USERNAME",
      sql.VarChar(255),
      normalizeUsernameValue(input.authorUsername) || null,
    )
    .input(
      "AUTOR_NOME",
      sql.NVarChar(255),
      String(input.authorName ?? "").trim() || null,
    )
    .input("CRIADO_EM", sql.DateTime2, createdAt)
    .query(`
      DECLARE @EXISTING_ID UNIQUEIDENTIFIER

      SELECT TOP 1 @EXISTING_ID = ID
      FROM dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
      WHERE USERNAME = @USERNAME
        AND TIPO = @TIPO
        AND TRILHA_ID = @TRILHA_ID

      IF @EXISTING_ID IS NULL
      BEGIN
        INSERT INTO dbo.TTREINAMENTO_NOTIFICACOES_FLUXO (
          ID,
          USERNAME,
          TIPO,
          TRILHA_ID,
          TRILHA_TITULO,
          MODULO_ID,
          SETOR_ORIGEM_CHAVE,
          SETOR_ORIGEM_LABEL,
          SETOR_DESTINO_CHAVE,
          AUTOR_USERNAME,
          AUTOR_NOME,
          CRIADO_EM,
          LIDA_EM
        )
        VALUES (
          @ID,
          @USERNAME,
          @TIPO,
          @TRILHA_ID,
          @TRILHA_TITULO,
          @MODULO_ID,
          @SETOR_ORIGEM_CHAVE,
          @SETOR_ORIGEM_LABEL,
          @SETOR_DESTINO_CHAVE,
          @AUTOR_USERNAME,
          @AUTOR_NOME,
          @CRIADO_EM,
          NULL
        )
      END
      ELSE
      BEGIN
        UPDATE dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
        SET TRILHA_TITULO = @TRILHA_TITULO,
            MODULO_ID = @MODULO_ID,
            SETOR_ORIGEM_CHAVE = @SETOR_ORIGEM_CHAVE,
            SETOR_ORIGEM_LABEL = @SETOR_ORIGEM_LABEL,
            SETOR_DESTINO_CHAVE = @SETOR_DESTINO_CHAVE,
            AUTOR_USERNAME = @AUTOR_USERNAME,
            AUTOR_NOME = @AUTOR_NOME,
            CRIADO_EM = @CRIADO_EM,
            LIDA_EM = NULL
        WHERE ID = @EXISTING_ID

        SET @ID = @EXISTING_ID
      END

      SELECT
        ID,
        USERNAME,
        TIPO,
        TRILHA_ID,
        TRILHA_TITULO,
        MODULO_ID,
        SETOR_ORIGEM_CHAVE,
        SETOR_ORIGEM_LABEL,
        SETOR_DESTINO_CHAVE,
        AUTOR_USERNAME,
        AUTOR_NOME,
        CRIADO_EM,
        LIDA_EM
      FROM dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
      WHERE ID = @ID
    `)

  const row = result.recordset[0] as TrainingWorkflowNotificationRecord | undefined
  return row ? mapTrainingWorkflowNotificationRecord(row) : null
}

export async function clearTrainingWorkflowNotifications(params: {
  trainingId: string
  type?: TrainingWorkflowNotificationType | null
}) {
  await ensureTrainingWorkflowNotificationSchema()

  const trainingId = String(params.trainingId ?? "").trim()
  if (!trainingId) {
    return [] as string[]
  }

  const pool = await getPool()
  const request = pool
    .request()
    .input("TRILHA_ID", sql.UniqueIdentifier, trainingId)

  const typeClause = params.type
    ? "AND TIPO = @TIPO"
    : ""

  if (params.type) {
    request.input("TIPO", sql.VarChar(40), params.type)
  }

  const result = await request.query(`
    DECLARE @DELETED TABLE (USERNAME VARCHAR(255))

    DELETE FROM dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
    OUTPUT deleted.USERNAME INTO @DELETED (USERNAME)
    WHERE TRILHA_ID = @TRILHA_ID
    ${typeClause}

    SELECT DISTINCT USERNAME
    FROM @DELETED
    WHERE USERNAME IS NOT NULL AND LTRIM(RTRIM(USERNAME)) <> ''
  `)

  return Array.from(
    new Set(
      (result.recordset as Array<{ USERNAME?: string | null }>)
        .map((row) => normalizeUsernameValue(row.USERNAME))
        .filter(Boolean),
    ),
  )
}

export async function setTrainingWorkflowNotificationReadState(params: {
  id: string
  read: boolean
  username: string
}) {
  await ensureTrainingWorkflowNotificationSchema()

  const username = normalizeUsernameValue(params.username)
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, params.id)
    .input("USERNAME", sql.VarChar(255), username)
    .query(
      params.read
        ? `
          UPDATE dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
          SET LIDA_EM = SYSUTCDATETIME()
          WHERE ID = @ID
            AND USERNAME = @USERNAME
            AND LIDA_EM IS NULL
        `
        : `
          UPDATE dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
          SET LIDA_EM = NULL
          WHERE ID = @ID
            AND USERNAME = @USERNAME
            AND LIDA_EM IS NOT NULL
        `,
    )

  return (result.rowsAffected[0] ?? 0) > 0
}

export async function markAllTrainingWorkflowNotificationsAsRead(username: string) {
  await ensureTrainingWorkflowNotificationSchema()

  const normalizedUsername = normalizeUsernameValue(username)
  const pool = await getPool()
  await pool
    .request()
    .input("USERNAME", sql.VarChar(255), normalizedUsername)
    .query(`
      UPDATE dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
      SET LIDA_EM = SYSUTCDATETIME()
      WHERE USERNAME = @USERNAME
        AND LIDA_EM IS NULL
    `)
}
