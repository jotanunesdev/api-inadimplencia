"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasSectorFolderShareTable = hasSectorFolderShareTable;
exports.isSectorFolderShareTableMissingError = isSectorFolderShareTableMissingError;
exports.listSectorFolderSharesByItemId = listSectorFolderSharesByItemId;
exports.listSectorFolderSharesByTargetSector = listSectorFolderSharesByTargetSector;
exports.getSectorFolderShareByTargetAndItem = getSectorFolderShareByTargetAndItem;
exports.syncSectorFolderShares = syncSectorFolderShares;
exports.deleteSectorFolderSharesByItemIds = deleteSectorFolderSharesByItemIds;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
async function hasSectorFolderShareTable() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT OBJECT_ID('dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS') AS TABLE_ID
  `);
    return Boolean(result.recordset[0]?.TABLE_ID);
}
function isSectorFolderShareTableMissingError(error) {
    const code = error?.code;
    return code === "SECTOR_FOLDER_SHARE_TABLE_MISSING";
}
async function ensureSectorFolderShareTable() {
    if (await hasSectorFolderShareTable()) {
        return;
    }
    const error = new Error("Tabela de compartilhamento de pasta por setor ausente");
    error.code =
        "SECTOR_FOLDER_SHARE_TABLE_MISSING";
    throw error;
}
async function listSectorFolderSharesByItemId(itemId) {
    await ensureSectorFolderShareTable();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("SHAREPOINT_ITEM_ID", db_1.sql.NVarChar(255), itemId)
        .query(`
      SELECT
        ID,
        SHAREPOINT_ITEM_ID,
        SETOR_ORIGEM_CHAVE,
        SETOR_DESTINO_CHAVE,
        COMPARTILHADO_POR_NOME,
        COMPARTILHADO_POR_EMAIL,
        COMPARTILHADO_POR_USUARIO,
        COMPARTILHADO_EM
      FROM dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS
      WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
      ORDER BY SETOR_DESTINO_CHAVE
    `);
    return result.recordset;
}
async function listSectorFolderSharesByTargetSector(targetSectorKey) {
    await ensureSectorFolderShareTable();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("SETOR_DESTINO_CHAVE", db_1.sql.NVarChar(120), targetSectorKey)
        .query(`
      SELECT
        ID,
        SHAREPOINT_ITEM_ID,
        SETOR_ORIGEM_CHAVE,
        SETOR_DESTINO_CHAVE,
        COMPARTILHADO_POR_NOME,
        COMPARTILHADO_POR_EMAIL,
        COMPARTILHADO_POR_USUARIO,
        COMPARTILHADO_EM
      FROM dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS
      WHERE SETOR_DESTINO_CHAVE = @SETOR_DESTINO_CHAVE
      ORDER BY COMPARTILHADO_EM DESC, SHAREPOINT_ITEM_ID
    `);
    return result.recordset;
}
async function getSectorFolderShareByTargetAndItem(params) {
    await ensureSectorFolderShareTable();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("SHAREPOINT_ITEM_ID", db_1.sql.NVarChar(255), params.itemId)
        .input("SETOR_DESTINO_CHAVE", db_1.sql.NVarChar(120), params.targetSectorKey)
        .query(`
      SELECT TOP 1
        ID,
        SHAREPOINT_ITEM_ID,
        SETOR_ORIGEM_CHAVE,
        SETOR_DESTINO_CHAVE,
        COMPARTILHADO_POR_NOME,
        COMPARTILHADO_POR_EMAIL,
        COMPARTILHADO_POR_USUARIO,
        COMPARTILHADO_EM
      FROM dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS
      WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
        AND SETOR_DESTINO_CHAVE = @SETOR_DESTINO_CHAVE
    `);
    return result.recordset[0] ?? null;
}
async function syncSectorFolderShares(params) {
    await ensureSectorFolderShareTable();
    const pool = await (0, db_1.getPool)();
    const normalizedTargets = Array.from(new Set(params.targetSectorKeys
        .map((item) => String(item ?? "").trim().toLowerCase())
        .filter((item) => item && item !== params.sourceSectorKey.trim().toLowerCase())));
    await pool
        .request()
        .input("SHAREPOINT_ITEM_ID", db_1.sql.NVarChar(255), params.itemId)
        .query(`
      DELETE FROM dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS
      WHERE SHAREPOINT_ITEM_ID = @SHAREPOINT_ITEM_ID
    `);
    for (const targetSectorKey of normalizedTargets) {
        // eslint-disable-next-line no-await-in-loop
        await pool
            .request()
            .input("ID", db_1.sql.UniqueIdentifier, (0, crypto_1.randomUUID)())
            .input("SHAREPOINT_ITEM_ID", db_1.sql.NVarChar(255), params.itemId)
            .input("SETOR_ORIGEM_CHAVE", db_1.sql.NVarChar(120), params.sourceSectorKey.trim().toLowerCase())
            .input("SETOR_DESTINO_CHAVE", db_1.sql.NVarChar(120), targetSectorKey)
            .input("COMPARTILHADO_POR_NOME", db_1.sql.NVarChar(255), params.sharedByName ?? null)
            .input("COMPARTILHADO_POR_EMAIL", db_1.sql.NVarChar(255), params.sharedByEmail ?? null)
            .input("COMPARTILHADO_POR_USUARIO", db_1.sql.NVarChar(255), params.sharedByUsername ?? null)
            .input("COMPARTILHADO_EM", db_1.sql.DateTime2, new Date())
            .query(`
        INSERT INTO dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS (
          ID,
          SHAREPOINT_ITEM_ID,
          SETOR_ORIGEM_CHAVE,
          SETOR_DESTINO_CHAVE,
          COMPARTILHADO_POR_NOME,
          COMPARTILHADO_POR_EMAIL,
          COMPARTILHADO_POR_USUARIO,
          COMPARTILHADO_EM
        )
        VALUES (
          @ID,
          @SHAREPOINT_ITEM_ID,
          @SETOR_ORIGEM_CHAVE,
          @SETOR_DESTINO_CHAVE,
          @COMPARTILHADO_POR_NOME,
          @COMPARTILHADO_POR_EMAIL,
          @COMPARTILHADO_POR_USUARIO,
          @COMPARTILHADO_EM
        )
      `);
    }
    return listSectorFolderSharesByItemId(params.itemId);
}
async function deleteSectorFolderSharesByItemIds(itemIds) {
    await ensureSectorFolderShareTable();
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
    DELETE FROM dbo.TGESTAO_ARQUIVOS_SETOR_COMPARTILHAMENTOS
    WHERE SHAREPOINT_ITEM_ID IN (${parameterNames.join(", ")})
  `);
}
