"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTrainingMatrix = listTrainingMatrix;
exports.getTrainingMatrixById = getTrainingMatrixById;
exports.createTrainingMatrix = createTrainingMatrix;
exports.updateTrainingMatrix = updateTrainingMatrix;
exports.deleteTrainingMatrix = deleteTrainingMatrix;
const db_1 = require("../config/db");
async function listTrainingMatrix(cargo) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    let query = "SELECT * FROM dbo.TMTREINAMENTO";
    if (cargo) {
        request.input("CARGO_FK", db_1.sql.VarChar(255), cargo);
        query += " WHERE CARGO_FK = @CARGO_FK";
    }
    const result = await request.query(query);
    return result.recordset;
}
async function getTrainingMatrixById(id) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("SELECT * FROM dbo.TMTREINAMENTO WHERE ID = @ID");
    return result.recordset[0];
}
async function createTrainingMatrix(input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.id)
        .input("CARGO_FK", db_1.sql.VarChar(255), input.cargoFk)
        .input("CURSO_ID", db_1.sql.UniqueIdentifier, input.cursoId)
        .input("QTD_HORAS", db_1.sql.Int, input.qtdHoras ?? null)
        .input("TITULO", db_1.sql.VarChar(255), input.titulo ?? null)
        .input("PROVA", db_1.sql.VarBinary(db_1.sql.MAX), input.prova ?? null)
        .query("INSERT INTO dbo.TMTREINAMENTO (ID, CARGO_FK, CURSO_ID, QTD_HORAS, TITULO, PROVA) VALUES (@ID, @CARGO_FK, @CURSO_ID, @QTD_HORAS, @TITULO, @PROVA)");
    return getTrainingMatrixById(input.id);
}
async function updateTrainingMatrix(id, input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("CARGO_FK", db_1.sql.VarChar(255), input.cargoFk)
        .input("CURSO_ID", db_1.sql.UniqueIdentifier, input.cursoId)
        .input("QTD_HORAS", db_1.sql.Int, input.qtdHoras ?? null)
        .input("TITULO", db_1.sql.VarChar(255), input.titulo ?? null)
        .input("PROVA", db_1.sql.VarBinary(db_1.sql.MAX), input.prova ?? null)
        .query("UPDATE dbo.TMTREINAMENTO SET CARGO_FK = @CARGO_FK, CURSO_ID = @CURSO_ID, QTD_HORAS = @QTD_HORAS, TITULO = @TITULO, PROVA = @PROVA WHERE ID = @ID");
    return getTrainingMatrixById(id);
}
async function deleteTrainingMatrix(id) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("DELETE FROM dbo.TMTREINAMENTO WHERE ID = @ID");
}
