"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSectorFolderTrashTableMissingError = isSectorFolderTrashTableMissingError;
exports.listSectorFolderTrashItems = listSectorFolderTrashItems;
exports.getSectorFolderTrashByItemId = getSectorFolderTrashByItemId;
exports.upsertSectorFolderTrashItem = upsertSectorFolderTrashItem;
exports.deleteSectorFolderTrashByItemIds = deleteSectorFolderTrashByItemIds;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const TABLE_NAME = "dbo.TGESTAO_ARQUIVOS_SETOR_LIXEIRA";
function isSectorFolderTrashTableMissingError(error) {
    const code = error?.code;
    return code === "SECTOR_FOLDER_TRASH_TABLE_MISSING";
}
async function ensureSectorFolderTrashTable() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT OBJECT_ID('${TABLE_NAME}', 'U') AS TABLE_ID
  `);
    if (result.recordset[0]?.TABLE_ID) {
        return;
    }
    const error = new Error("Tabela de lixeira do gerenciador ausente");
    error.code =
        "SECTOR_FOLDER_TRASH_TABLE_MISSING";
    throw error;
}
async function listSectorFolderTrashItems(sectorKey) {
    await ensureSectorFolderTrashTable();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("SETOR_CHAVE", db_1.sql.NVarChar(120), sectorKey)
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
    `);
    return result.recordset;
}
async function getSectorFolderTrashByItemId(itemId) {
    await ensureSectorFolderTrashTable();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("SHAREPOINT_ITEM_ID", db_1.sql.NVarChar(255), itemId)
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
    `);
    return result.recordset[0] ?? null;
}
async function upsertSectorFolderTrashItem(input) {
    await ensureSectorFolderTrashTable();
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, (0, crypto_1.randomUUID)())
        .input("SHAREPOINT_ITEM_ID", db_1.sql.NVarChar(255), input.itemId)
        .input("SETOR_CHAVE", db_1.sql.NVarChar(120), input.sectorKey)
        .input("NOME", db_1.sql.NVarChar(255), input.name)
        .input("CAMINHO", db_1.sql.NVarChar(1000), input.path)
        .input("TIPO_ITEM", db_1.sql.NVarChar(30), input.itemType)
        .input("EXTENSAO", db_1.sql.NVarChar(50), input.extension ?? null)
        .input("TAMANHO", db_1.sql.BigInt, input.size ?? null)
        .input("WEB_URL", db_1.sql.NVarChar(1200), input.webUrl ?? null)
        .input("EXCLUIDO_POR_NOME", db_1.sql.NVarChar(255), input.deletedByName ?? null)
        .input("EXCLUIDO_POR_EMAIL", db_1.sql.NVarChar(255), input.deletedByEmail ?? null)
        .input("EXCLUIDO_POR_USUARIO", db_1.sql.NVarChar(255), input.deletedByUsername ?? null)
        .input("EXCLUIDO_EM", db_1.sql.DateTime2, input.deletedAt ?? new Date())
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
    `);
    return getSectorFolderTrashByItemId(input.itemId);
}
async function deleteSectorFolderTrashByItemIds(itemIds) {
    await ensureSectorFolderTrashTable();
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
