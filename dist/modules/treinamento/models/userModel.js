"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserByCpf = getUserByCpf;
exports.upsertUser = upsertUser;
exports.updateUserPassword = updateUserPassword;
exports.listUsers = listUsers;
exports.listInstructors = listInstructors;
exports.setInstructorFlag = setInstructorFlag;
exports.setInstructorFlags = setInstructorFlags;
exports.clearAllInstructors = clearAllInstructors;
const db_1 = require("../config/db");
async function getUserByCpf(cpf) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("CPF", db_1.sql.VarChar(100), cpf)
        .query("SELECT * FROM dbo.TUSUARIOS WHERE CPF = @CPF");
    return result.recordset[0];
}
async function upsertUser(input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("CPF", db_1.sql.VarChar(100), input.cpf)
        .input("NOME", db_1.sql.VarChar(100), input.nome ?? null)
        .input("IDADE", db_1.sql.Int, input.idade ?? null)
        .input("SEXO", db_1.sql.VarChar(15), input.sexo ?? null)
        .input("NOMEFILIAL", db_1.sql.VarChar(255), input.nomeFilial ?? null)
        .input("DTNASCIMENTO", db_1.sql.Date, input.dtNascimento ?? null)
        .input("CARGO", db_1.sql.VarChar(250), input.cargo ?? null)
        .input("SETOR", db_1.sql.VarChar(255), input.setor ?? null)
        .input("ATIVO", db_1.sql.Bit, input.ativo ?? null)
        .input("PERMISSAO", db_1.sql.VarChar(255), input.permissao ?? null)
        .input("HASH_SENHA", db_1.sql.VarChar(255), input.hashSenha ?? null)
        .input("READVIEW_JSON", db_1.sql.NVarChar(db_1.sql.MAX), input.readViewJson ?? null)
        .input("INSTRUTOR", db_1.sql.Bit, input.instrutor ?? null)
        .query(`
      IF EXISTS (SELECT 1 FROM dbo.TUSUARIOS WHERE CPF = @CPF)
      BEGIN
        UPDATE dbo.TUSUARIOS
        SET
          NOME = @NOME,
          IDADE = @IDADE,
          SEXO = @SEXO,
          NOMEFILIAL = @NOMEFILIAL,
          DTNASCIMENTO = @DTNASCIMENTO,
          CARGO = @CARGO,
          SETOR = @SETOR,
          ATIVO = @ATIVO,
          PERMISSAO = COALESCE(@PERMISSAO, PERMISSAO),
          HASH_SENHA = COALESCE(@HASH_SENHA, HASH_SENHA),
          READVIEW_JSON = COALESCE(@READVIEW_JSON, READVIEW_JSON),
          INSTRUTOR = COALESCE(@INSTRUTOR, INSTRUTOR)
        WHERE CPF = @CPF
      END
      ELSE
      BEGIN
        INSERT INTO dbo.TUSUARIOS (
          CPF,
          NOME,
          IDADE,
          SEXO,
          NOMEFILIAL,
          DTNASCIMENTO,
          HASH_SENHA,
          QTD_CURSOS_REALIZADOS,
          HORAS_CURSOS_REALIZADOS,
          CARGO,
          SETOR,
          ATIVO,
          PERMISSAO,
          READVIEW_JSON,
          INSTRUTOR
        )
        VALUES (
          @CPF,
          @NOME,
          @IDADE,
          @SEXO,
          @NOMEFILIAL,
          @DTNASCIMENTO,
          @HASH_SENHA,
          0,
          0,
          @CARGO,
          @SETOR,
          @ATIVO,
          COALESCE(@PERMISSAO, 'usuario'),
          @READVIEW_JSON,
          COALESCE(@INSTRUTOR, 0)
        )
      END
    `);
    const user = await getUserByCpf(input.cpf);
    return user;
}
async function updateUserPassword(cpf, hash) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("CPF", db_1.sql.VarChar(100), cpf)
        .input("HASH_SENHA", db_1.sql.VarChar(255), hash)
        .query("UPDATE dbo.TUSUARIOS SET HASH_SENHA = @HASH_SENHA WHERE CPF = @CPF");
    return getUserByCpf(cpf);
}
async function listUsers(filters) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const conditions = [];
    if (filters?.cpf) {
        request.input("CPF", db_1.sql.VarChar(100), `%${filters.cpf}%`);
        conditions.push("CPF LIKE @CPF");
    }
    if (filters?.nome) {
        request.input("NOME", db_1.sql.VarChar(255), `%${filters.nome}%`);
        conditions.push("NOME LIKE @NOME");
    }
    if (filters?.ativo !== undefined) {
        request.input("ATIVO", db_1.sql.Bit, filters.ativo ? 1 : 0);
        conditions.push("ATIVO = @ATIVO");
    }
    if (filters?.instrutor !== undefined) {
        request.input("INSTRUTOR", db_1.sql.Bit, filters.instrutor ? 1 : 0);
        conditions.push("INSTRUTOR = @INSTRUTOR");
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await request.query(`
    SELECT CPF, NOME, CARGO, SETOR, ATIVO, INSTRUTOR
    FROM dbo.TUSUARIOS
    ${where}
    ORDER BY NOME
  `);
    return result.recordset;
}
async function listInstructors() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT CPF, NOME, CARGO, SETOR, INSTRUTOR
    FROM dbo.TUSUARIOS
    WHERE INSTRUTOR = 1
    ORDER BY NOME
  `);
    return result.recordset;
}
async function setInstructorFlag(cpf, isInstructor) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("CPF", db_1.sql.VarChar(100), cpf)
        .input("INSTRUTOR", db_1.sql.Bit, isInstructor ? 1 : 0)
        .query(`
      UPDATE dbo.TUSUARIOS
      SET INSTRUTOR = @INSTRUTOR
      WHERE CPF = @CPF
    `);
}
async function setInstructorFlags(cpfList, isInstructor) {
    const uniqueCpfs = Array.from(new Set(cpfList.map((value) => String(value ?? "").trim()).filter(Boolean)));
    if (uniqueCpfs.length === 0) {
        return;
    }
    const pool = await (0, db_1.getPool)();
    const request = pool.request().input("INSTRUTOR", db_1.sql.Bit, isInstructor ? 1 : 0);
    const placeholders = uniqueCpfs.map((cpf, index) => {
        const inputName = `CPF${index}`;
        request.input(inputName, db_1.sql.VarChar(100), cpf);
        return `@${inputName}`;
    });
    await request.query(`
    UPDATE dbo.TUSUARIOS
    SET INSTRUTOR = @INSTRUTOR
    WHERE CPF IN (${placeholders.join(", ")})
  `);
}
async function clearAllInstructors() {
    const pool = await (0, db_1.getPool)();
    await pool.request().query(`
    UPDATE dbo.TUSUARIOS
    SET INSTRUTOR = 0
    WHERE INSTRUTOR = 1
  `);
}
