"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCourses = listCourses;
exports.getCourseById = getCourseById;
exports.createCourse = createCourse;
exports.updateCourse = updateCourse;
exports.deleteCourse = deleteCourse;
const db_1 = require("../config/db");
async function listCourses() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query("SELECT * FROM dbo.TCURSOS");
    return result.recordset;
}
async function getCourseById(id) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("SELECT * FROM dbo.TCURSOS WHERE ID = @ID");
    return result.recordset[0];
}
async function createCourse(input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.id)
        .input("TITULO", db_1.sql.VarChar(255), input.titulo ?? null)
        .input("DESCRICAO", db_1.sql.VarChar(255), input.descricao ?? null)
        .input("DURACAO", db_1.sql.Int, input.duracao ?? null)
        .input("MATERIAL_APOIO", db_1.sql.NVarChar(db_1.sql.MAX), input.materialApoio ?? null)
        .query("INSERT INTO dbo.TCURSOS (ID, TITULO, DESCRICAO, DURACAO, MATERIAL_APOIO) VALUES (@ID, @TITULO, @DESCRICAO, @DURACAO, @MATERIAL_APOIO)");
    return getCourseById(input.id);
}
async function updateCourse(id, input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("TITULO", db_1.sql.VarChar(255), input.titulo ?? null)
        .input("DESCRICAO", db_1.sql.VarChar(255), input.descricao ?? null)
        .input("DURACAO", db_1.sql.Int, input.duracao ?? null)
        .input("MATERIAL_APOIO", db_1.sql.NVarChar(db_1.sql.MAX), input.materialApoio ?? null)
        .query("UPDATE dbo.TCURSOS SET TITULO = @TITULO, DESCRICAO = @DESCRICAO, DURACAO = @DURACAO, MATERIAL_APOIO = @MATERIAL_APOIO WHERE ID = @ID");
    return getCourseById(id);
}
async function deleteCourse(id) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("DELETE FROM dbo.TCURSOS WHERE ID = @ID");
}
