"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProcedimentos = listProcedimentos;
exports.getProcedimentoById = getProcedimentoById;
exports.listProcedimentoVersionsById = listProcedimentoVersionsById;
exports.createProcedimento = createProcedimento;
exports.updateProcedimento = updateProcedimento;
exports.deleteProcedimento = deleteProcedimento;
exports.listLinkedMaterialsByProcedimento = listLinkedMaterialsByProcedimento;
const db_1 = require("../config/db");
async function listProcedimentos() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT ID, NOME, PATH_PDF, OBSERVACOES, VERSAO, ALTERADO_EM
    FROM (
      SELECT
        p.ID,
        p.NOME,
        p.PATH_PDF,
        p.OBSERVACOES,
        p.VERSAO,
        p.ALTERADO_EM,
        ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
      FROM dbo.TPROCEDIMENTOS p
    ) p
    WHERE p.RN = 1
    ORDER BY p.NOME
  `);
    return result.recordset;
}
async function getProcedimentoById(id, versao) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request().input("ID", db_1.sql.UniqueIdentifier, id);
    if (versao !== undefined) {
        request.input("VERSAO", db_1.sql.Int, versao);
        const result = await request.query("SELECT * FROM dbo.TPROCEDIMENTOS WHERE ID = @ID AND VERSAO = @VERSAO");
        return result.recordset[0];
    }
    const result = await request.query("SELECT TOP 1 * FROM dbo.TPROCEDIMENTOS WHERE ID = @ID ORDER BY VERSAO DESC");
    return result.recordset[0];
}
async function listProcedimentoVersionsById(id) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query(`
      SELECT ID, NOME, PATH_PDF, OBSERVACOES, VERSAO, ALTERADO_EM
      FROM dbo.TPROCEDIMENTOS
      WHERE ID = @ID
      ORDER BY VERSAO DESC
    `);
    return result.recordset;
}
async function createProcedimento(input) {
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
        .input("ALTERADO_EM", db_1.sql.DateTime2, input.alteradoEm ?? new Date())
        .query(`
      INSERT INTO dbo.TPROCEDIMENTOS (
        ID,
        NOME,
        PATH_PDF,
        OBSERVACOES,
        VERSAO,
        ALTERADO_EM
      )
      VALUES (
        @ID,
        @NOME,
        @PATH_PDF,
        @OBSERVACOES,
        @VERSAO,
        @ALTERADO_EM
      )
    `);
    return getProcedimentoById(input.id, normalizedVersion);
}
async function updateProcedimento(id, input) {
    const latest = await getProcedimentoById(id);
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
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("NOME", db_1.sql.NVarChar(255), nome)
        .input("PATH_PDF", db_1.sql.NVarChar(1000), pathPdf)
        .input("OBSERVACOES", db_1.sql.NVarChar(db_1.sql.MAX), observacoes)
        .input("VERSAO", db_1.sql.Int, nextVersion)
        .input("ALTERADO_EM", db_1.sql.DateTime2, input.alteradoEm ?? new Date())
        .query(`
      INSERT INTO dbo.TPROCEDIMENTOS (
        ID,
        NOME,
        PATH_PDF,
        OBSERVACOES,
        VERSAO,
        ALTERADO_EM
      )
      VALUES (
        @ID,
        @NOME,
        @PATH_PDF,
        @OBSERVACOES,
        @VERSAO,
        @ALTERADO_EM
      )
    `);
    return getProcedimentoById(id, nextVersion);
}
async function deleteProcedimento(id) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("DELETE FROM dbo.TPROCEDIMENTOS WHERE ID = @ID");
}
async function listLinkedMaterialsByProcedimento(procedimentoId) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, procedimentoId)
        .query(`
      WITH V_LATEST AS (
        SELECT
          v.ID,
          v.TRILHA_FK_ID,
          v.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
      ),
      P_LATEST AS (
        SELECT
          p.ID,
          p.TRILHA_FK_ID,
          p.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPDFS p
      )
      SELECT
        CAST('video' AS VARCHAR(10)) AS TIPO,
        v.ID AS MATERIAL_ID,
        v.TRILHA_FK_ID AS TRILHA_ID
      FROM V_LATEST v
      WHERE v.RN = 1
        AND v.PROCEDIMENTO_ID = @PROCEDIMENTO_ID

      UNION ALL

      SELECT
        CAST('pdf' AS VARCHAR(10)) AS TIPO,
        p.ID AS MATERIAL_ID,
        p.TRILHA_FK_ID AS TRILHA_ID
      FROM P_LATEST p
      WHERE p.RN = 1
        AND p.PROCEDIMENTO_ID = @PROCEDIMENTO_ID
    `);
    return result.recordset;
}
