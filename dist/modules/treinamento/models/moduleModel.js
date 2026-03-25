"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listModules = listModules;
exports.listModulesByUser = listModulesByUser;
exports.getModuleById = getModuleById;
exports.createModule = createModule;
exports.updateModule = updateModule;
exports.deleteModule = deleteModule;
const db_1 = require("../config/db");
async function listModules() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT m.*,
      COALESCE(d.TOTAL_SEGUNDOS, 0) AS DURACAO_SEGUNDOS,
      CAST(COALESCE(d.TOTAL_SEGUNDOS, 0) / 3600.0 AS DECIMAL(10, 2)) AS DURACAO_HORAS
    FROM dbo.TMODULOS m
    LEFT JOIN (
      SELECT t.MODULO_FK_ID, SUM(ISNULL(v.DURACAO_SEGUNDOS, 0)) AS TOTAL_SEGUNDOS
      FROM dbo.TTRILHAS t
      JOIN (
        SELECT
          ID,
          TRILHA_FK_ID,
          DURACAO_SEGUNDOS,
          ROW_NUMBER() OVER (PARTITION BY ID ORDER BY VERSAO DESC) AS RN
        FROM dbo.TVIDEOS
      ) v ON v.TRILHA_FK_ID = t.ID AND v.RN = 1
      GROUP BY t.MODULO_FK_ID
    ) d ON d.MODULO_FK_ID = m.ID
  `);
    return result.recordset;
}
async function listModulesByUser(cpf) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
        .query(`
      SELECT m.*,
        COALESCE(d.TOTAL_SEGUNDOS, 0) AS DURACAO_SEGUNDOS,
        CAST(COALESCE(d.TOTAL_SEGUNDOS, 0) / 3600.0 AS DECIMAL(10, 2)) AS DURACAO_HORAS
      FROM dbo.TMODULOS m
      JOIN dbo.TTRILHAS t ON t.MODULO_FK_ID = m.ID
      JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = t.ID
      LEFT JOIN (
        SELECT t2.MODULO_FK_ID, SUM(ISNULL(v.DURACAO_SEGUNDOS, 0)) AS TOTAL_SEGUNDOS
        FROM dbo.TTRILHAS t2
        JOIN (
          SELECT
            ID,
            TRILHA_FK_ID,
            DURACAO_SEGUNDOS,
            ROW_NUMBER() OVER (PARTITION BY ID ORDER BY VERSAO DESC) AS RN
          FROM dbo.TVIDEOS
        ) v ON v.TRILHA_FK_ID = t2.ID AND v.RN = 1
        GROUP BY t2.MODULO_FK_ID
      ) d ON d.MODULO_FK_ID = m.ID
      WHERE ut.USUARIO_CPF = @USUARIO_CPF
      GROUP BY m.ID, m.NOME, m.QTD_TRILHAS, m.CRIADO_POR, m.PATH, d.TOTAL_SEGUNDOS
    `);
    return result.recordset;
}
async function getModuleById(id) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("SELECT * FROM dbo.TMODULOS WHERE ID = @ID");
    return result.recordset[0];
}
async function createModule(input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.id)
        .input("NOME", db_1.sql.NVarChar(255), input.nome)
        .input("QTD_TRILHAS", db_1.sql.Int, input.qtdTrilhas ?? 0)
        .input("CRIADO_POR", db_1.sql.NVarChar(255), input.criadoPor ?? null)
        .input("PATH", db_1.sql.NVarChar(500), input.path ?? null)
        .query("INSERT INTO dbo.TMODULOS (ID, NOME, QTD_TRILHAS, CRIADO_POR, PATH) VALUES (@ID, @NOME, @QTD_TRILHAS, @CRIADO_POR, @PATH)");
    return getModuleById(input.id);
}
async function updateModule(id, input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("NOME", db_1.sql.NVarChar(255), input.nome ?? null)
        .input("QTD_TRILHAS", db_1.sql.Int, input.qtdTrilhas ?? null)
        .input("CRIADO_POR", db_1.sql.NVarChar(255), input.criadoPor ?? null)
        .input("PATH", db_1.sql.NVarChar(500), input.path ?? null)
        .query("UPDATE dbo.TMODULOS SET NOME = COALESCE(@NOME, NOME), QTD_TRILHAS = COALESCE(@QTD_TRILHAS, QTD_TRILHAS), CRIADO_POR = COALESCE(@CRIADO_POR, CRIADO_POR), PATH = COALESCE(@PATH, PATH) WHERE ID = @ID");
    return getModuleById(id);
}
async function deleteModule(id) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("DELETE FROM dbo.TMODULOS WHERE ID = @ID");
}
