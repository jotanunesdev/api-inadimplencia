"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUserCourses = listUserCourses;
exports.createUserCourse = createUserCourse;
exports.updateUserCourse = updateUserCourse;
exports.deleteUserCourse = deleteUserCourse;
const db_1 = require("../config/db");
async function listUserCourses(cpf) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
        .query("SELECT * FROM dbo.TUSUARIO_CURSOS WHERE USUARIO_CPF = @USUARIO_CPF");
    return result.recordset;
}
async function createUserCourse(input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.id)
        .input("USUARIO_CPF", db_1.sql.VarChar(100), input.cpf)
        .input("CURSO_ID", db_1.sql.UniqueIdentifier, input.cursoId)
        .input("STATUS", db_1.sql.VarChar(50), input.status)
        .input("DT_INICIO", db_1.sql.Date, input.dtInicio ?? null)
        .input("DT_CONCLUSAO", db_1.sql.Date, input.dtConclusao ?? null)
        .query("INSERT INTO dbo.TUSUARIO_CURSOS (ID, USUARIO_CPF, CURSO_ID, STATUS, DT_INICIO, DT_CONCLUSAO) VALUES (@ID, @USUARIO_CPF, @CURSO_ID, @STATUS, @DT_INICIO, @DT_CONCLUSAO)");
}
async function updateUserCourse(id, input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("STATUS", db_1.sql.VarChar(50), input.status)
        .input("DT_INICIO", db_1.sql.Date, input.dtInicio ?? null)
        .input("DT_CONCLUSAO", db_1.sql.Date, input.dtConclusao ?? null)
        .query("UPDATE dbo.TUSUARIO_CURSOS SET STATUS = @STATUS, DT_INICIO = @DT_INICIO, DT_CONCLUSAO = @DT_CONCLUSAO WHERE ID = @ID");
}
async function deleteUserCourse(id) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("DELETE FROM dbo.TUSUARIO_CURSOS WHERE ID = @ID");
}
