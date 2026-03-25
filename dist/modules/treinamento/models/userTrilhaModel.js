"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignTrilhas = assignTrilhas;
exports.listUserTrilhas = listUserTrilhas;
exports.removeUserTrilha = removeUserTrilha;
exports.isUserAssignedToTrilha = isUserAssignedToTrilha;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
async function assignTrilhas(cpf, trilhaIds, atribuidoPor) {
    const pool = await (0, db_1.getPool)();
    let inserted = 0;
    for (const trilhaId of trilhaIds) {
        // eslint-disable-next-line no-await-in-loop
        const result = await pool
            .request()
            .input("ID", db_1.sql.UniqueIdentifier, (0, crypto_1.randomUUID)())
            .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
            .input("TRILHA_ID", db_1.sql.UniqueIdentifier, trilhaId)
            .input("ATRIBUIDO_POR", db_1.sql.VarChar(100), atribuidoPor ?? null)
            .query(`
        INSERT INTO dbo.TUSUARIO_TRILHAS (
          ID,
          USUARIO_CPF,
          TRILHA_ID,
          ATRIBUIDO_POR
        )
        SELECT
          @ID,
          @USUARIO_CPF,
          @TRILHA_ID,
          @ATRIBUIDO_POR
        WHERE NOT EXISTS (
          SELECT 1
          FROM dbo.TUSUARIO_TRILHAS
          WHERE USUARIO_CPF = @USUARIO_CPF
            AND TRILHA_ID = @TRILHA_ID
        )
      `);
        if (result.rowsAffected[0] > 0) {
            inserted += 1;
        }
    }
    return { inserted };
}
async function listUserTrilhas(cpf, moduloId) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request().input("USUARIO_CPF", db_1.sql.VarChar(100), cpf);
    let query = `
    SELECT t.*
    FROM dbo.TTRILHAS t
    JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = t.ID
    WHERE ut.USUARIO_CPF = @USUARIO_CPF
  `;
    if (moduloId) {
        request.input("MODULO_FK_ID", db_1.sql.UniqueIdentifier, moduloId);
        query += " AND t.MODULO_FK_ID = @MODULO_FK_ID";
    }
    const result = await request.query(query);
    return result.recordset;
}
async function removeUserTrilha(cpf, trilhaId) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
        .input("TRILHA_ID", db_1.sql.UniqueIdentifier, trilhaId)
        .query("DELETE FROM dbo.TUSUARIO_TRILHAS WHERE USUARIO_CPF = @USUARIO_CPF AND TRILHA_ID = @TRILHA_ID");
    return result.rowsAffected[0] > 0;
}
async function isUserAssignedToTrilha(cpf, trilhaId) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
        .input("TRILHA_ID", db_1.sql.UniqueIdentifier, trilhaId)
        .query(`
      SELECT TOP 1 1 AS EXISTS_ROW
      FROM dbo.TUSUARIO_TRILHAS
      WHERE USUARIO_CPF = @USUARIO_CPF
        AND TRILHA_ID = @TRILHA_ID
    `);
    return result.recordset.length > 0;
}
