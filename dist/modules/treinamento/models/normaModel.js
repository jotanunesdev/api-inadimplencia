"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNormas = listNormas;
exports.getNormaById = getNormaById;
exports.listNormaVersionsById = listNormaVersionsById;
exports.createNorma = createNorma;
exports.updateNorma = updateNorma;
exports.deleteNorma = deleteNorma;
const db_1 = require("../config/db");
async function listNormas() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT ID, NOME, PATH_PDF, OBSERVACOES, VERSAO, VALIDADE_MESES, VALIDADE_ANOS, ALTERADO_EM
    FROM (
      SELECT
        n.ID,
        n.NOME,
        n.PATH_PDF,
        n.OBSERVACOES,
        n.VERSAO,
        n.VALIDADE_MESES,
        n.VALIDADE_ANOS,
        n.ALTERADO_EM,
        ROW_NUMBER() OVER (PARTITION BY n.ID ORDER BY n.VERSAO DESC) AS RN
      FROM dbo.TNORMAS n
    ) n
    WHERE n.RN = 1
    ORDER BY n.NOME
  `);
    return result.recordset;
}
async function getNormaById(id, versao) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request().input("ID", db_1.sql.UniqueIdentifier, id);
    if (versao !== undefined) {
        request.input("VERSAO", db_1.sql.Int, versao);
        const result = await request.query("SELECT * FROM dbo.TNORMAS WHERE ID = @ID AND VERSAO = @VERSAO");
        return result.recordset[0];
    }
    const result = await request.query("SELECT TOP 1 * FROM dbo.TNORMAS WHERE ID = @ID ORDER BY VERSAO DESC");
    return result.recordset[0];
}
async function listNormaVersionsById(id) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query(`
      SELECT ID, NOME, PATH_PDF, OBSERVACOES, VERSAO, VALIDADE_MESES, VALIDADE_ANOS, ALTERADO_EM
      FROM dbo.TNORMAS
      WHERE ID = @ID
      ORDER BY VERSAO DESC
    `);
    return result.recordset;
}
async function createNorma(input) {
    const pool = await (0, db_1.getPool)();
    const normalizedVersion = input.versao !== undefined && input.versao !== null
        ? Math.max(1, Math.trunc(input.versao))
        : 1;
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.id)
        .input("NOME", db_1.sql.NVarChar(255), input.nome)
        .input("PATH_PDF", db_1.sql.NVarChar(1000), input.pathPdf)
        .input("OBSERVACOES", db_1.sql.NVarChar(db_1.sql.MAX), input.observacoes ?? null)
        .input("VERSAO", db_1.sql.Int, normalizedVersion)
        .input("VALIDADE_MESES", db_1.sql.TinyInt, input.validadeMeses)
        .input("VALIDADE_ANOS", db_1.sql.TinyInt, input.validadeAnos)
        .input("ALTERADO_EM", db_1.sql.DateTime2, input.alteradoEm ?? new Date())
        .query(`
      INSERT INTO dbo.TNORMAS (
        ID,
        NOME,
        PATH_PDF,
        OBSERVACOES,
        VERSAO,
        VALIDADE_MESES,
        VALIDADE_ANOS,
        ALTERADO_EM
      )
      VALUES (
        @ID,
        @NOME,
        @PATH_PDF,
        @OBSERVACOES,
        @VERSAO,
        @VALIDADE_MESES,
        @VALIDADE_ANOS,
        @ALTERADO_EM
      )
    `);
    return getNormaById(input.id, normalizedVersion);
}
async function updateNorma(id, input) {
    const latest = await getNormaById(id);
    if (!latest) {
        return undefined;
    }
    const requestedVersion = input.versao !== undefined && input.versao !== null
        ? Math.max(1, Math.trunc(input.versao))
        : null;
    const nextVersion = requestedVersion !== null
        ? Math.max(requestedVersion, (latest.VERSAO ?? 0) + 1)
        : (latest.VERSAO ?? 0) + 1;
    const nome = input.nome?.trim() || latest.NOME;
    const pathPdf = input.pathPdf?.trim() || latest.PATH_PDF;
    const observacoes = input.observacoes !== undefined ? input.observacoes : (latest.OBSERVACOES ?? null);
    const validadeMeses = input.validadeMeses ?? latest.VALIDADE_MESES;
    const validadeAnos = input.validadeAnos ?? latest.VALIDADE_ANOS;
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("NOME", db_1.sql.NVarChar(255), nome)
        .input("PATH_PDF", db_1.sql.NVarChar(1000), pathPdf)
        .input("OBSERVACOES", db_1.sql.NVarChar(db_1.sql.MAX), observacoes)
        .input("VERSAO", db_1.sql.Int, nextVersion)
        .input("VALIDADE_MESES", db_1.sql.TinyInt, validadeMeses)
        .input("VALIDADE_ANOS", db_1.sql.TinyInt, validadeAnos)
        .input("ALTERADO_EM", db_1.sql.DateTime2, input.alteradoEm ?? new Date())
        .query(`
      INSERT INTO dbo.TNORMAS (
        ID,
        NOME,
        PATH_PDF,
        OBSERVACOES,
        VERSAO,
        VALIDADE_MESES,
        VALIDADE_ANOS,
        ALTERADO_EM
      )
      VALUES (
        @ID,
        @NOME,
        @PATH_PDF,
        @OBSERVACOES,
        @VERSAO,
        @VALIDADE_MESES,
        @VALIDADE_ANOS,
        @ALTERADO_EM
      )
    `);
    return getNormaById(id, nextVersion);
}
async function deleteNorma(id) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("DELETE FROM dbo.TNORMAS WHERE ID = @ID");
}
