"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSectorFolderUserItemTableMissingError = isSectorFolderUserItemTableMissingError;
exports.listSectorFolderUserItemRelationsByItemIds = listSectorFolderUserItemRelationsByItemIds;
exports.listFavoriteSectorFolderUserItems = listFavoriteSectorFolderUserItems;
exports.listRecentSectorFolderUserItems = listRecentSectorFolderUserItems;
exports.registerSectorFolderAccess = registerSectorFolderAccess;
exports.setSectorFolderFavorite = setSectorFolderFavorite;
exports.deleteSectorFolderUserItemsByItemIds = deleteSectorFolderUserItemsByItemIds;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const TABLE_NAME = "dbo.TGESTAO_ARQUIVOS_SETOR_USUARIO_ITENS";
function isSectorFolderUserItemTableMissingError(error) {
    const code = error?.code;
    return code === "SECTOR_FOLDER_USER_ITEM_TABLE_MISSING";
}
async function ensureSectorFolderUserItemTable() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT OBJECT_ID('${TABLE_NAME}', 'U') AS TABLE_ID
  `);
    if (result.recordset[0]?.TABLE_ID) {
        return;
    }
    const error = new Error("Tabela de itens de usuario do gerenciador ausente");
    error.code =
        "SECTOR_FOLDER_USER_ITEM_TABLE_MISSING";
    throw error;
}
async function listSectorFolderUserItemRelationsByItemIds(params) {
    await ensureSectorFolderUserItemTable();
    const normalizedIds = Array.from(new Set(params.itemIds.map((item) => String(item ?? "").trim()).filter(Boolean)));
    if (normalizedIds.length === 0) {
        return [];
    }
    const pool = await (0, db_1.getPool)();
    const request = pool
        .request()
        .input("SETOR_VISUALIZACAO_CHAVE", db_1.sql.NVarChar(120), params.viewerSectorKey)
        .input("USUARIO", db_1.sql.NVarChar(255), params.username);
    const parameterNames = normalizedIds.map((itemId, index) => {
        const parameterName = `ITEM_ID_${index}`;
        request.input(parameterName, db_1.sql.NVarChar(255), itemId);
        return `@${parameterName}`;
    });
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
  `);
    return result.recordset;
}
async function listFavoriteSectorFolderUserItems(params) {
    await ensureSectorFolderUserItemTable();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("SETOR_VISUALIZACAO_CHAVE", db_1.sql.NVarChar(120), params.viewerSectorKey)
        .input("USUARIO", db_1.sql.NVarChar(255), params.username)
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
    `);
    return result.recordset;
}
async function listRecentSectorFolderUserItems(params) {
    await ensureSectorFolderUserItemTable();
    const pool = await (0, db_1.getPool)();
    const withinDays = Number(params.withinDays ?? 15);
    const result = await pool
        .request()
        .input("SETOR_VISUALIZACAO_CHAVE", db_1.sql.NVarChar(120), params.viewerSectorKey)
        .input("USUARIO", db_1.sql.NVarChar(255), params.username)
        .input("WITHIN_DAYS", db_1.sql.Int, withinDays)
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
    `);
    return result.recordset;
}
async function ensureUserItemRecord(params) {
    await ensureSectorFolderUserItemTable();
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, (0, crypto_1.randomUUID)())
        .input("SHAREPOINT_ITEM_ID", db_1.sql.NVarChar(255), params.itemId)
        .input("SETOR_VISUALIZACAO_CHAVE", db_1.sql.NVarChar(120), params.viewerSectorKey)
        .input("SETOR_ORIGEM_CHAVE", db_1.sql.NVarChar(120), params.sourceSectorKey)
        .input("RAIZ_COMPARTILHADA_ITEM_ID", db_1.sql.NVarChar(255), params.sharedRootItemId ?? null)
        .input("USUARIO", db_1.sql.NVarChar(255), params.username)
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
    `);
}
async function registerSectorFolderAccess(params) {
    await ensureUserItemRecord(params);
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("SHAREPOINT_ITEM_ID", db_1.sql.NVarChar(255), params.itemId)
        .input("SETOR_VISUALIZACAO_CHAVE", db_1.sql.NVarChar(120), params.viewerSectorKey)
        .input("SETOR_ORIGEM_CHAVE", db_1.sql.NVarChar(120), params.sourceSectorKey)
        .input("RAIZ_COMPARTILHADA_ITEM_ID", db_1.sql.NVarChar(255), params.sharedRootItemId ?? null)
        .input("USUARIO", db_1.sql.NVarChar(255), params.username)
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
    `);
}
async function setSectorFolderFavorite(params) {
    await ensureUserItemRecord(params);
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("SHAREPOINT_ITEM_ID", db_1.sql.NVarChar(255), params.itemId)
        .input("SETOR_VISUALIZACAO_CHAVE", db_1.sql.NVarChar(120), params.viewerSectorKey)
        .input("SETOR_ORIGEM_CHAVE", db_1.sql.NVarChar(120), params.sourceSectorKey)
        .input("RAIZ_COMPARTILHADA_ITEM_ID", db_1.sql.NVarChar(255), params.sharedRootItemId ?? null)
        .input("USUARIO", db_1.sql.NVarChar(255), params.username)
        .input("FAVORITO", db_1.sql.Bit, params.favorite)
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
    `);
}
async function deleteSectorFolderUserItemsByItemIds(itemIds) {
    await ensureSectorFolderUserItemTable();
    const normalizedIds = Array.from(new Set(itemIds.map((item) => String(item ?? "").trim()).filter(Boolean)));
    if (normalizedIds.length === 0) {
        return;
    }
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const parameterNames = normalizedIds.map((itemId, index) => {
        const parameterName = `ITEM_ID_${index}`;
        request.input(parameterName, db_1.sql.NVarChar(255), itemId);
        return `@${parameterName}`;
    });
    await request.query(`
    DELETE FROM ${TABLE_NAME}
    WHERE SHAREPOINT_ITEM_ID IN (${parameterNames.join(", ")})
  `);
}
