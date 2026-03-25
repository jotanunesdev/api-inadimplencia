"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasTrilhaShareTable = hasTrilhaShareTable;
exports.listTrilhaSharesByTrilha = listTrilhaSharesByTrilha;
exports.syncTrilhaShares = syncTrilhaShares;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
async function hasTrilhaShareTable() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT OBJECT_ID('dbo.TTRILHA_SETOR_COMPARTILHAMENTOS') AS TABLE_ID
  `);
    return Boolean(result.recordset[0]?.TABLE_ID);
}
async function ensureTrilhaShareTable() {
    if (await hasTrilhaShareTable()) {
        return;
    }
    const error = new Error("Tabela de compartilhamento de trilha ausente");
    error.code = "TRILHA_SHARE_TABLE_MISSING";
    throw error;
}
async function listTrilhaSharesByTrilha(trilhaId) {
    await ensureTrilhaShareTable();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("TRILHA_ID", db_1.sql.UniqueIdentifier, trilhaId)
        .query(`
      SELECT
        share.ID,
        share.TRILHA_ID,
        share.MODULO_DESTINO_ID,
        share.COMPARTILHADO_POR,
        share.COMPARTILHADO_EM,
        modulo.NOME AS MODULO_DESTINO_NOME
      FROM dbo.TTRILHA_SETOR_COMPARTILHAMENTOS share
      JOIN dbo.TMODULOS modulo ON modulo.ID = share.MODULO_DESTINO_ID
      WHERE share.TRILHA_ID = @TRILHA_ID
      ORDER BY modulo.NOME
    `);
    return result.recordset;
}
async function syncTrilhaShares(trilhaId, targetModuleIds, compartilhadoPor) {
    await ensureTrilhaShareTable();
    const pool = await (0, db_1.getPool)();
    const normalizedTargets = Array.from(new Set(targetModuleIds
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)));
    await pool
        .request()
        .input("TRILHA_ID", db_1.sql.UniqueIdentifier, trilhaId)
        .query(`
      DELETE FROM dbo.TTRILHA_SETOR_COMPARTILHAMENTOS
      WHERE TRILHA_ID = @TRILHA_ID
    `);
    for (const moduleId of normalizedTargets) {
        // eslint-disable-next-line no-await-in-loop
        await pool
            .request()
            .input("ID", db_1.sql.UniqueIdentifier, (0, crypto_1.randomUUID)())
            .input("TRILHA_ID", db_1.sql.UniqueIdentifier, trilhaId)
            .input("MODULO_DESTINO_ID", db_1.sql.UniqueIdentifier, moduleId)
            .input("COMPARTILHADO_POR", db_1.sql.NVarChar(255), compartilhadoPor ?? null)
            .input("COMPARTILHADO_EM", db_1.sql.DateTime2, new Date())
            .query(`
        INSERT INTO dbo.TTRILHA_SETOR_COMPARTILHAMENTOS (
          ID,
          TRILHA_ID,
          MODULO_DESTINO_ID,
          COMPARTILHADO_POR,
          COMPARTILHADO_EM
        )
        VALUES (
          @ID,
          @TRILHA_ID,
          @MODULO_DESTINO_ID,
          @COMPARTILHADO_POR,
          @COMPARTILHADO_EM
        )
      `);
    }
    return listTrilhaSharesByTrilha(trilhaId);
}
