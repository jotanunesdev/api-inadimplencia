import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type ProfileNotificationStatusFilter = "pendente" | "lida" | "todas"
export type ProfileNotificationType =
  | "new_message"
  | "reply"
  | "message_reply"
  | "message_like"

type ProfileNotificationRecord = {
  ID: string
  PROFILE_USERNAME: string
  TARGET_PROFILE_USERNAME: string | null
  MESSAGE_ID: string
  MESSAGE_PARENT_ID: string | null
  TIPO: ProfileNotificationType
  AUTOR_USERNAME: string
  AUTOR_NOME: string | null
  AUTOR_CARGO: string | null
  CRIADO_EM: Date
  LIDA_EM: Date | null
}

export type ProfileNotificationItem = {
  id: string
  profileUsername: string
  targetProfileUsername: string
  messageId: string
  messageParentId: string | null
  type: ProfileNotificationType
  authorUsername: string
  authorName: string | null
  authorJobTitle: string | null
  createdAt: string
  readAt: string | null
}

export type ProfileNotificationSnapshot = {
  generatedAt: string
  notifications: ProfileNotificationItem[]
  unreadCount: number
  username: string
}

const DEFAULT_NOTIFICATION_LIMIT = 10
const MAX_NOTIFICATION_LIMIT = 50

const normalizeUsernameValue = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.trim() ?? ""

let ensureProfileNotificationSchemaPromise: Promise<void> | null = null

async function ensureProfileNotificationSchema() {
  if (!ensureProfileNotificationSchemaPromise) {
    ensureProfileNotificationSchemaPromise = (async () => {
      const pool = await getPool()
      await pool.request().query(`
        IF OBJECT_ID('dbo.TPERFIL_NOTIFICACOES', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TPERFIL_NOTIFICACOES (
            ID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
            PROFILE_USERNAME VARCHAR(255) NOT NULL,
            TARGET_PROFILE_USERNAME VARCHAR(255) NULL,
            MESSAGE_ID UNIQUEIDENTIFIER NOT NULL,
            MESSAGE_PARENT_ID UNIQUEIDENTIFIER NULL,
            TIPO VARCHAR(20) NOT NULL,
            AUTOR_USERNAME VARCHAR(255) NOT NULL,
            AUTOR_NOME NVARCHAR(255) NULL,
            AUTOR_CARGO NVARCHAR(255) NULL,
            CRIADO_EM DATETIME2 NOT NULL,
            LIDA_EM DATETIME2 NULL
          )
        END

        IF COL_LENGTH('dbo.TPERFIL_NOTIFICACOES', 'TARGET_PROFILE_USERNAME') IS NULL
        BEGIN
          ALTER TABLE dbo.TPERFIL_NOTIFICACOES
          ADD TARGET_PROFILE_USERNAME VARCHAR(255) NULL
        END

        UPDATE dbo.TPERFIL_NOTIFICACOES
        SET TARGET_PROFILE_USERNAME = PROFILE_USERNAME
        WHERE TARGET_PROFILE_USERNAME IS NULL

        IF EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TPERFIL_NOTIFICACOES')
            AND name = 'UX_TPERFIL_NOTIFICACOES_MESSAGE'
        )
        BEGIN
          DROP INDEX UX_TPERFIL_NOTIFICACOES_MESSAGE
            ON dbo.TPERFIL_NOTIFICACOES
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TPERFIL_NOTIFICACOES')
            AND name = 'UX_TPERFIL_NOTIFICACOES_EVENT'
        )
        BEGIN
          CREATE UNIQUE INDEX UX_TPERFIL_NOTIFICACOES_EVENT
            ON dbo.TPERFIL_NOTIFICACOES (PROFILE_USERNAME, TIPO, MESSAGE_ID, AUTOR_USERNAME)
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TPERFIL_NOTIFICACOES')
            AND name = 'IX_TPERFIL_NOTIFICACOES_PROFILE_CREATED'
        )
        BEGIN
          CREATE INDEX IX_TPERFIL_NOTIFICACOES_PROFILE_CREATED
            ON dbo.TPERFIL_NOTIFICACOES (PROFILE_USERNAME, CRIADO_EM)
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TPERFIL_NOTIFICACOES')
            AND name = 'IX_TPERFIL_NOTIFICACOES_PROFILE_READ'
        )
        BEGIN
          CREATE INDEX IX_TPERFIL_NOTIFICACOES_PROFILE_READ
            ON dbo.TPERFIL_NOTIFICACOES (PROFILE_USERNAME, LIDA_EM, CRIADO_EM)
        END
      `)
    })().finally(() => {
      ensureProfileNotificationSchemaPromise = null
    })
  }

  await ensureProfileNotificationSchemaPromise
}

function normalizeLimit(value: number | null | undefined) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_NOTIFICATION_LIMIT
  }

  return Math.min(Math.trunc(parsed), MAX_NOTIFICATION_LIMIT)
}

function mapProfileNotificationRecord(
  record: ProfileNotificationRecord,
): ProfileNotificationItem {
  return {
    id: record.ID,
    profileUsername: record.PROFILE_USERNAME,
    targetProfileUsername: normalizeUsernameValue(
      record.TARGET_PROFILE_USERNAME ?? record.PROFILE_USERNAME,
    ),
    messageId: record.MESSAGE_ID,
    messageParentId: record.MESSAGE_PARENT_ID,
    type: record.TIPO,
    authorUsername: record.AUTOR_USERNAME,
    authorName: record.AUTOR_NOME,
    authorJobTitle: record.AUTOR_CARGO,
    createdAt: new Date(record.CRIADO_EM).toISOString(),
    readAt: record.LIDA_EM ? new Date(record.LIDA_EM).toISOString() : null,
  }
}

export async function listProfileNotifications(params: {
  username: string
  status?: ProfileNotificationStatusFilter
  limit?: number | null
}) {
  await ensureProfileNotificationSchema()

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
    .input("PROFILE_USERNAME", sql.VarChar(255), username)
    .input("LIMIT", sql.Int, limit)
    .query(`
      SELECT TOP (@LIMIT)
        ID,
        PROFILE_USERNAME,
        TARGET_PROFILE_USERNAME,
        MESSAGE_ID,
        MESSAGE_PARENT_ID,
        TIPO,
        AUTOR_USERNAME,
        AUTOR_NOME,
        AUTOR_CARGO,
        CRIADO_EM,
        LIDA_EM
      FROM dbo.TPERFIL_NOTIFICACOES
      WHERE PROFILE_USERNAME = @PROFILE_USERNAME
      ${statusClause}
      ORDER BY
        CASE WHEN LIDA_EM IS NULL THEN 0 ELSE 1 END,
        CRIADO_EM DESC,
        ID DESC
    `)

  return (result.recordset as ProfileNotificationRecord[]).map(
    mapProfileNotificationRecord,
  )
}

export async function countUnreadProfileNotifications(username: string) {
  await ensureProfileNotificationSchema()

  const normalizedUsername = normalizeUsernameValue(username)
  const pool = await getPool()
  const result = await pool
    .request()
    .input("PROFILE_USERNAME", sql.VarChar(255), normalizedUsername)
    .query(`
      SELECT COUNT(1) AS TOTAL
      FROM dbo.TPERFIL_NOTIFICACOES
      WHERE PROFILE_USERNAME = @PROFILE_USERNAME
        AND LIDA_EM IS NULL
    `)

  return Number(result.recordset[0]?.TOTAL ?? 0)
}

export async function getProfileNotificationSnapshot(params: {
  username: string
  status?: ProfileNotificationStatusFilter
  limit?: number | null
}): Promise<ProfileNotificationSnapshot> {
  const username = normalizeUsernameValue(params.username)

  const [notifications, unreadCount] = await Promise.all([
    listProfileNotifications(params),
    countUnreadProfileNotifications(username),
  ])

  return {
    generatedAt: new Date().toISOString(),
    notifications,
    unreadCount,
    username,
  }
}

export async function createProfileNotification(input: {
  recipientUsername: string
  targetProfileUsername?: string | null
  messageId: string
  messageParentId?: string | null
  type: ProfileNotificationType
  authorUsername: string
  authorName?: string | null
  authorJobTitle?: string | null
}) {
  await ensureProfileNotificationSchema()

  const recipientUsername = normalizeUsernameValue(input.recipientUsername)
  const targetProfileUsername =
    normalizeUsernameValue(input.targetProfileUsername) || recipientUsername
  const authorUsername = normalizeUsernameValue(input.authorUsername)
  const messageId = String(input.messageId ?? "").trim()
  const messageParentId = String(input.messageParentId ?? "").trim() || null

  if (!recipientUsername || !authorUsername || !messageId) {
    return null
  }

  if (recipientUsername === authorUsername) {
    return null
  }

  const id = randomUUID()
  const createdAt = new Date()

  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("PROFILE_USERNAME", sql.VarChar(255), recipientUsername)
    .input(
      "TARGET_PROFILE_USERNAME",
      sql.VarChar(255),
      targetProfileUsername,
    )
    .input("MESSAGE_ID", sql.UniqueIdentifier, messageId)
    .input("MESSAGE_PARENT_ID", sql.UniqueIdentifier, messageParentId)
    .input("TIPO", sql.VarChar(20), input.type)
    .input("AUTOR_USERNAME", sql.VarChar(255), authorUsername)
    .input(
      "AUTOR_NOME",
      sql.NVarChar(255),
      String(input.authorName ?? "").trim() || null,
    )
    .input(
      "AUTOR_CARGO",
      sql.NVarChar(255),
      String(input.authorJobTitle ?? "").trim() || null,
    )
    .input("CRIADO_EM", sql.DateTime2, createdAt)
    .query(`
      DECLARE @EXISTING_ID UNIQUEIDENTIFIER

      SELECT TOP 1 @EXISTING_ID = ID
      FROM dbo.TPERFIL_NOTIFICACOES
      WHERE PROFILE_USERNAME = @PROFILE_USERNAME
        AND TIPO = @TIPO
        AND MESSAGE_ID = @MESSAGE_ID
        AND AUTOR_USERNAME = @AUTOR_USERNAME

      IF @EXISTING_ID IS NULL
      BEGIN
        INSERT INTO dbo.TPERFIL_NOTIFICACOES (
          ID,
          PROFILE_USERNAME,
          TARGET_PROFILE_USERNAME,
          MESSAGE_ID,
          MESSAGE_PARENT_ID,
          TIPO,
          AUTOR_USERNAME,
          AUTOR_NOME,
          AUTOR_CARGO,
          CRIADO_EM,
          LIDA_EM
        )
        VALUES (
          @ID,
          @PROFILE_USERNAME,
          @TARGET_PROFILE_USERNAME,
          @MESSAGE_ID,
          @MESSAGE_PARENT_ID,
          @TIPO,
          @AUTOR_USERNAME,
          @AUTOR_NOME,
          @AUTOR_CARGO,
          @CRIADO_EM,
          NULL
        )
      END
      ELSE
      BEGIN
        UPDATE dbo.TPERFIL_NOTIFICACOES
        SET TARGET_PROFILE_USERNAME = @TARGET_PROFILE_USERNAME,
            MESSAGE_PARENT_ID = @MESSAGE_PARENT_ID,
            AUTOR_NOME = @AUTOR_NOME,
            AUTOR_CARGO = @AUTOR_CARGO,
            CRIADO_EM = @CRIADO_EM,
            LIDA_EM = NULL
        WHERE ID = @EXISTING_ID

        SET @ID = @EXISTING_ID
      END

      SELECT
        ID,
        PROFILE_USERNAME,
        TARGET_PROFILE_USERNAME,
        MESSAGE_ID,
        MESSAGE_PARENT_ID,
        TIPO,
        AUTOR_USERNAME,
        AUTOR_NOME,
        AUTOR_CARGO,
        CRIADO_EM,
        LIDA_EM
      FROM dbo.TPERFIL_NOTIFICACOES
      WHERE ID = @ID
    `)

  const record = result.recordset[0] as ProfileNotificationRecord | undefined
  return record ? mapProfileNotificationRecord(record) : null
}

export async function setProfileNotificationReadState(params: {
  id: string
  read: boolean
  username: string
}) {
  await ensureProfileNotificationSchema()

  const id = String(params.id ?? "").trim()
  const username = normalizeUsernameValue(params.username)

  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("PROFILE_USERNAME", sql.VarChar(255), username)
    .query(
      params.read
        ? `
            UPDATE dbo.TPERFIL_NOTIFICACOES
            SET LIDA_EM = SYSUTCDATETIME()
            WHERE ID = @ID
              AND PROFILE_USERNAME = @PROFILE_USERNAME
          `
        : `
            UPDATE dbo.TPERFIL_NOTIFICACOES
            SET LIDA_EM = NULL
            WHERE ID = @ID
              AND PROFILE_USERNAME = @PROFILE_USERNAME
          `,
    )

  return (result.rowsAffected[0] ?? 0) > 0
}

export async function markAllProfileNotificationsAsRead(username: string) {
  await ensureProfileNotificationSchema()

  const normalizedUsername = normalizeUsernameValue(username)
  const pool = await getPool()
  const result = await pool
    .request()
    .input("PROFILE_USERNAME", sql.VarChar(255), normalizedUsername)
    .query(`
      UPDATE dbo.TPERFIL_NOTIFICACOES
      SET LIDA_EM = SYSUTCDATETIME()
      WHERE PROFILE_USERNAME = @PROFILE_USERNAME
        AND LIDA_EM IS NULL
    `)

  return result.rowsAffected[0] ?? 0
}
