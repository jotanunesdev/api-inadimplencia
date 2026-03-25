"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvaAttempt = createProvaAttempt;
exports.getLatestProvaAttemptByTrilha = getLatestProvaAttemptByTrilha;
exports.listProvaAttemptsReport = listProvaAttemptsReport;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
async function createProvaAttempt(input) {
    const pool = await (0, db_1.getPool)();
    const id = (0, crypto_1.randomUUID)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("USUARIO_CPF", db_1.sql.VarChar(100), input.cpf)
        .input("PROVA_ID", db_1.sql.UniqueIdentifier, input.provaId)
        .input("PROVA_VERSAO", db_1.sql.Int, input.provaVersao)
        .input("TRILHA_ID", db_1.sql.UniqueIdentifier, input.trilhaId)
        .input("NOTA", db_1.sql.Decimal(5, 2), input.nota)
        .input("STATUS", db_1.sql.VarChar(20), input.status)
        .input("ACERTOS", db_1.sql.Int, input.acertos)
        .input("TOTAL_QUESTOES", db_1.sql.Int, input.totalQuestoes)
        .input("RESPOSTAS_JSON", db_1.sql.NVarChar(db_1.sql.MAX), input.respostasJson ?? null)
        .input("DT_REALIZACAO", db_1.sql.DateTime2, input.realizadoEm ?? new Date())
        .query(`
      INSERT INTO dbo.TUSUARIO_PROVA_TENTATIVAS (
        ID,
        USUARIO_CPF,
        PROVA_ID,
        PROVA_VERSAO,
        TRILHA_ID,
        NOTA,
        STATUS,
        ACERTOS,
        TOTAL_QUESTOES,
        RESPOSTAS_JSON,
        DT_REALIZACAO
      )
      VALUES (
        @ID,
        @USUARIO_CPF,
        @PROVA_ID,
        @PROVA_VERSAO,
        @TRILHA_ID,
        @NOTA,
        @STATUS,
        @ACERTOS,
        @TOTAL_QUESTOES,
        @RESPOSTAS_JSON,
        @DT_REALIZACAO
      )
    `);
    return id;
}
async function getLatestProvaAttemptByTrilha(cpf, trilhaId) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
        .input("TRILHA_ID", db_1.sql.UniqueIdentifier, trilhaId)
        .query(`
      SELECT TOP 1
        ID,
        USUARIO_CPF,
        PROVA_ID,
        PROVA_VERSAO,
        TRILHA_ID,
        NOTA,
        STATUS,
        ACERTOS,
        TOTAL_QUESTOES,
        RESPOSTAS_JSON,
        DT_REALIZACAO
      FROM dbo.TUSUARIO_PROVA_TENTATIVAS
      WHERE USUARIO_CPF = @USUARIO_CPF
        AND TRILHA_ID = @TRILHA_ID
      ORDER BY DT_REALIZACAO DESC
    `);
    return result.recordset[0];
}
async function listProvaAttemptsReport(filters) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const conditions = [];
    if (filters?.trilhaId) {
        request.input("TRILHA_ID", db_1.sql.UniqueIdentifier, filters.trilhaId);
        conditions.push("a.TRILHA_ID = @TRILHA_ID");
    }
    if (filters?.status) {
        request.input("STATUS", db_1.sql.VarChar(20), filters.status);
        conditions.push("a.STATUS = @STATUS");
    }
    if (filters?.dateFrom) {
        request.input("DATE_FROM", db_1.sql.DateTime2, filters.dateFrom);
        conditions.push("a.DT_REALIZACAO >= @DATE_FROM");
    }
    if (filters?.dateTo) {
        request.input("DATE_TO", db_1.sql.DateTime2, filters.dateTo);
        conditions.push("a.DT_REALIZACAO <= @DATE_TO");
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await request.query(`
      SELECT
        a.ID,
        a.USUARIO_CPF,
        a.PROVA_ID,
        a.PROVA_VERSAO,
        a.TRILHA_ID,
        a.NOTA,
        a.STATUS,
        a.ACERTOS,
        a.TOTAL_QUESTOES,
        a.RESPOSTAS_JSON,
        a.DT_REALIZACAO,
        u.NOME AS USUARIO_NOME,
        u.CARGO AS USUARIO_FUNCAO,
        m.ID AS MODULO_ID,
        m.NOME AS MODULO_NOME,
        tr.TITULO AS TRILHA_TITULO,
        p.TITULO AS PROVA_TITULO
      FROM dbo.TUSUARIO_PROVA_TENTATIVAS a
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = a.USUARIO_CPF
      LEFT JOIN dbo.TTRILHAS tr ON tr.ID = a.TRILHA_ID
      LEFT JOIN dbo.TMODULOS m ON m.ID = tr.MODULO_FK_ID
      LEFT JOIN dbo.TPROVAS p ON p.ID = a.PROVA_ID
      ${where}
      ORDER BY a.DT_REALIZACAO DESC
    `);
    return result.recordset;
}
