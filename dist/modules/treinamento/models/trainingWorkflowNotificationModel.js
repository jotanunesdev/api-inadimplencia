"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTrainingWorkflowNotifications = listTrainingWorkflowNotifications;
exports.countUnreadTrainingWorkflowNotifications = countUnreadTrainingWorkflowNotifications;
exports.getTrainingWorkflowNotificationSnapshot = getTrainingWorkflowNotificationSnapshot;
exports.createTrainingWorkflowNotification = createTrainingWorkflowNotification;
exports.clearTrainingWorkflowNotifications = clearTrainingWorkflowNotifications;
exports.setTrainingWorkflowNotificationReadState = setTrainingWorkflowNotificationReadState;
exports.markAllTrainingWorkflowNotificationsAsRead = markAllTrainingWorkflowNotificationsAsRead;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const sectorAccess_1 = require("../utils/sectorAccess");
const DEFAULT_NOTIFICATION_LIMIT = 10;
const MAX_NOTIFICATION_LIMIT = 50;
let ensureTrainingWorkflowNotificationSchemaPromise = null;
async function ensureTrainingWorkflowNotificationSchema() {
    if (!ensureTrainingWorkflowNotificationSchemaPromise) {
        ensureTrainingWorkflowNotificationSchemaPromise = (async () => {
            const pool = await (0, db_1.getPool)();
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
      `);
        })().finally(() => {
            ensureTrainingWorkflowNotificationSchemaPromise = null;
        });
    }
    await ensureTrainingWorkflowNotificationSchemaPromise;
}
function normalizeLimit(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_NOTIFICATION_LIMIT;
    }
    return Math.min(Math.trunc(parsed), MAX_NOTIFICATION_LIMIT);
}
function mapTrainingWorkflowNotificationRecord(record) {
    return {
        id: record.ID,
        username: (0, sectorAccess_1.normalizeUsernameValue)(record.USERNAME),
        type: record.TIPO,
        trainingId: record.TRILHA_ID,
        trainingTitle: record.TRILHA_TITULO,
        moduleId: record.MODULO_ID,
        sourceSectorKey: record.SETOR_ORIGEM_CHAVE,
        sourceSectorLabel: record.SETOR_ORIGEM_LABEL,
        destinationSectorKey: record.SETOR_DESTINO_CHAVE,
        authorUsername: record.AUTOR_USERNAME
            ? (0, sectorAccess_1.normalizeUsernameValue)(record.AUTOR_USERNAME)
            : null,
        authorName: record.AUTOR_NOME,
        createdAt: new Date(record.CRIADO_EM).toISOString(),
        readAt: record.LIDA_EM ? new Date(record.LIDA_EM).toISOString() : null,
    };
}
async function listTrainingWorkflowNotifications(params) {
    await ensureTrainingWorkflowNotificationSchema();
    const username = (0, sectorAccess_1.normalizeUsernameValue)(params.username);
    const status = params.status ?? "todas";
    const limit = normalizeLimit(params.limit);
    let statusClause = "";
    if (status === "pendente") {
        statusClause = "AND LIDA_EM IS NULL";
    }
    else if (status === "lida") {
        statusClause = "AND LIDA_EM IS NOT NULL";
    }
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USERNAME", db_1.sql.VarChar(255), username)
        .input("LIMIT", db_1.sql.Int, limit)
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
    `);
    return result.recordset.map(mapTrainingWorkflowNotificationRecord);
}
async function countUnreadTrainingWorkflowNotifications(username) {
    await ensureTrainingWorkflowNotificationSchema();
    const normalizedUsername = (0, sectorAccess_1.normalizeUsernameValue)(username);
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USERNAME", db_1.sql.VarChar(255), normalizedUsername)
        .query(`
      SELECT COUNT(1) AS TOTAL
      FROM dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
      WHERE USERNAME = @USERNAME
        AND LIDA_EM IS NULL
    `);
    return Number(result.recordset[0]?.TOTAL ?? 0);
}
async function getTrainingWorkflowNotificationSnapshot(params) {
    const username = (0, sectorAccess_1.normalizeUsernameValue)(params.username);
    const [notifications, unreadCount] = await Promise.all([
        listTrainingWorkflowNotifications(params),
        countUnreadTrainingWorkflowNotifications(username),
    ]);
    return {
        generatedAt: new Date().toISOString(),
        notifications,
        unreadCount,
        username,
    };
}
async function createTrainingWorkflowNotification(input) {
    await ensureTrainingWorkflowNotificationSchema();
    const recipientUsername = (0, sectorAccess_1.normalizeUsernameValue)(input.recipientUsername);
    const trainingId = String(input.trainingId ?? "").trim();
    if (!recipientUsername || !trainingId) {
        return null;
    }
    const id = (0, crypto_1.randomUUID)();
    const createdAt = new Date();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("USERNAME", db_1.sql.VarChar(255), recipientUsername)
        .input("TIPO", db_1.sql.VarChar(40), input.type)
        .input("TRILHA_ID", db_1.sql.UniqueIdentifier, trainingId)
        .input("TRILHA_TITULO", db_1.sql.NVarChar(255), String(input.trainingTitle ?? "").trim() || null)
        .input("MODULO_ID", db_1.sql.UniqueIdentifier, input.moduleId ?? null)
        .input("SETOR_ORIGEM_CHAVE", db_1.sql.VarChar(120), String(input.sourceSectorKey ?? "").trim() || null)
        .input("SETOR_ORIGEM_LABEL", db_1.sql.NVarChar(120), String(input.sourceSectorLabel ?? "").trim() || null)
        .input("SETOR_DESTINO_CHAVE", db_1.sql.VarChar(120), String(input.destinationSectorKey ?? "").trim() || null)
        .input("AUTOR_USERNAME", db_1.sql.VarChar(255), (0, sectorAccess_1.normalizeUsernameValue)(input.authorUsername) || null)
        .input("AUTOR_NOME", db_1.sql.NVarChar(255), String(input.authorName ?? "").trim() || null)
        .input("CRIADO_EM", db_1.sql.DateTime2, createdAt)
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
    `);
    const row = result.recordset[0];
    return row ? mapTrainingWorkflowNotificationRecord(row) : null;
}
async function clearTrainingWorkflowNotifications(params) {
    await ensureTrainingWorkflowNotificationSchema();
    const trainingId = String(params.trainingId ?? "").trim();
    if (!trainingId) {
        return [];
    }
    const pool = await (0, db_1.getPool)();
    const request = pool
        .request()
        .input("TRILHA_ID", db_1.sql.UniqueIdentifier, trainingId);
    const typeClause = params.type
        ? "AND TIPO = @TIPO"
        : "";
    if (params.type) {
        request.input("TIPO", db_1.sql.VarChar(40), params.type);
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
  `);
    return Array.from(new Set(result.recordset
        .map((row) => (0, sectorAccess_1.normalizeUsernameValue)(row.USERNAME))
        .filter(Boolean)));
}
async function setTrainingWorkflowNotificationReadState(params) {
    await ensureTrainingWorkflowNotificationSchema();
    const username = (0, sectorAccess_1.normalizeUsernameValue)(params.username);
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, params.id)
        .input("USERNAME", db_1.sql.VarChar(255), username)
        .query(params.read
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
        `);
    return (result.rowsAffected[0] ?? 0) > 0;
}
async function markAllTrainingWorkflowNotificationsAsRead(username) {
    await ensureTrainingWorkflowNotificationSchema();
    const normalizedUsername = (0, sectorAccess_1.normalizeUsernameValue)(username);
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("USERNAME", db_1.sql.VarChar(255), normalizedUsername)
        .query(`
      UPDATE dbo.TTREINAMENTO_NOTIFICACOES_FLUXO
      SET LIDA_EM = SYSUTCDATETIME()
      WHERE USERNAME = @USERNAME
        AND LIDA_EM IS NULL
    `);
}
