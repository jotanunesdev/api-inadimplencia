"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestPlatformSatisfactionByCpf = getLatestPlatformSatisfactionByCpf;
exports.createPlatformSatisfaction = createPlatformSatisfaction;
exports.getPlatformSatisfactionSummary = getPlatformSatisfactionSummary;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
async function ensurePlatformSatisfactionTableExists() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT OBJECT_ID('dbo.TPESQUISA_SATISFACAO_PLATAFORMA', 'U') AS TABLE_ID
  `);
    const exists = Boolean(result.recordset[0]?.TABLE_ID);
    if (!exists) {
        const error = new Error("PLATFORM_SATISFACTION_TABLE_MISSING");
        error.code = "PLATFORM_SATISFACTION_TABLE_MISSING";
        throw error;
    }
}
async function getLatestPlatformSatisfactionByCpf(cpf) {
    await ensurePlatformSatisfactionTableExists();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
        .query(`
      SELECT TOP 1 ID, USUARIO_CPF, NIVEL_SATISFACAO, RESPONDIDO_EM
      FROM dbo.TPESQUISA_SATISFACAO_PLATAFORMA
      WHERE USUARIO_CPF = @USUARIO_CPF
      ORDER BY RESPONDIDO_EM DESC
    `);
    return result.recordset[0] ?? null;
}
async function createPlatformSatisfaction(input) {
    await ensurePlatformSatisfactionTableExists();
    const pool = await (0, db_1.getPool)();
    const respondidoEm = input.respondidoEm ?? new Date();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, (0, crypto_1.randomUUID)())
        .input("USUARIO_CPF", db_1.sql.VarChar(100), input.cpf)
        .input("NIVEL_SATISFACAO", db_1.sql.TinyInt, input.nivelSatisfacao)
        .input("RESPONDIDO_EM", db_1.sql.DateTime2, respondidoEm)
        .query(`
      INSERT INTO dbo.TPESQUISA_SATISFACAO_PLATAFORMA (
        ID,
        USUARIO_CPF,
        NIVEL_SATISFACAO,
        RESPONDIDO_EM
      )
      VALUES (
        @ID,
        @USUARIO_CPF,
        @NIVEL_SATISFACAO,
        @RESPONDIDO_EM
      )
    `);
    return { respondidoEm };
}
async function getPlatformSatisfactionSummary() {
    try {
        await ensurePlatformSatisfactionTableExists();
    }
    catch (error) {
        const code = error && typeof error === "object" && "code" in error
            ? String(error.code ?? "")
            : "";
        if (code === "PLATFORM_SATISFACTION_TABLE_MISSING") {
            return [];
        }
        throw error;
    }
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT
      NIVEL_SATISFACAO,
      COUNT(*) AS TOTAL
    FROM dbo.TPESQUISA_SATISFACAO_PLATAFORMA
    WHERE NIVEL_SATISFACAO BETWEEN 1 AND 5
    GROUP BY NIVEL_SATISFACAO
    ORDER BY NIVEL_SATISFACAO
  `);
    return result.recordset;
}
