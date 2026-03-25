"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserFace = createUserFace;
exports.getUserFaceById = getUserFaceById;
exports.listUserFaces = listUserFaces;
exports.listFaceDescriptorsForMatch = listFaceDescriptorsForMatch;
exports.getLatestUserFaceByCpf = getLatestUserFaceByCpf;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
async function createUserFace(input) {
    const pool = await (0, db_1.getPool)();
    const existing = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), input.cpf)
        .query(`
      SELECT TOP 1 ID
      FROM dbo.TUSUARIO_FACES
      WHERE USUARIO_CPF = @USUARIO_CPF
      ORDER BY CRIADO_EM DESC
    `);
    const current = existing.recordset[0];
    const id = current?.ID ?? (0, crypto_1.randomUUID)();
    if (current) {
        await pool
            .request()
            .input("ID", db_1.sql.UniqueIdentifier, id)
            .input("DESCRIPTOR_JSON", db_1.sql.NVarChar(db_1.sql.MAX), input.descriptorJson)
            .input("FOTO_BASE64", db_1.sql.NVarChar(db_1.sql.MAX), input.fotoBase64 ?? null)
            .input("FOTO_URL", db_1.sql.NVarChar(2000), input.fotoUrl ?? null)
            .input("ORIGEM", db_1.sql.VarChar(50), input.origem ?? null)
            .input("CRIADO_POR", db_1.sql.VarChar(100), input.criadoPor ?? null)
            .query(`
        UPDATE dbo.TUSUARIO_FACES
        SET
          DESCRIPTOR_JSON = @DESCRIPTOR_JSON,
          FOTO_BASE64 = @FOTO_BASE64,
          FOTO_URL = @FOTO_URL,
          ORIGEM = @ORIGEM,
          CRIADO_POR = @CRIADO_POR,
          CRIADO_EM = SYSUTCDATETIME()
        WHERE ID = @ID
      `);
    }
    else {
        await pool
            .request()
            .input("ID", db_1.sql.UniqueIdentifier, id)
            .input("USUARIO_CPF", db_1.sql.VarChar(100), input.cpf)
            .input("DESCRIPTOR_JSON", db_1.sql.NVarChar(db_1.sql.MAX), input.descriptorJson)
            .input("FOTO_BASE64", db_1.sql.NVarChar(db_1.sql.MAX), input.fotoBase64 ?? null)
            .input("FOTO_URL", db_1.sql.NVarChar(2000), input.fotoUrl ?? null)
            .input("ORIGEM", db_1.sql.VarChar(50), input.origem ?? null)
            .input("CRIADO_POR", db_1.sql.VarChar(100), input.criadoPor ?? null)
            .query(`
        INSERT INTO dbo.TUSUARIO_FACES (
          ID,
          USUARIO_CPF,
          DESCRIPTOR_JSON,
          FOTO_BASE64,
          FOTO_URL,
          ORIGEM,
          CRIADO_POR
        )
        VALUES (
          @ID,
          @USUARIO_CPF,
          @DESCRIPTOR_JSON,
          @FOTO_BASE64,
          @FOTO_URL,
          @ORIGEM,
          @CRIADO_POR
        )
      `);
    }
    await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), input.cpf)
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query(`
      DELETE FROM dbo.TUSUARIO_FACES
      WHERE USUARIO_CPF = @USUARIO_CPF
        AND ID <> @ID
    `);
    const created = await getUserFaceById(id);
    return created;
}
async function getUserFaceById(id) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query(`
      SELECT
        f.ID,
        f.USUARIO_CPF,
        u.NOME AS USUARIO_NOME,
        f.DESCRIPTOR_JSON,
        f.FOTO_BASE64,
        f.FOTO_URL,
        f.ORIGEM,
        f.CRIADO_POR,
        f.CRIADO_EM
      FROM dbo.TUSUARIO_FACES f
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = f.USUARIO_CPF
      WHERE f.ID = @ID
    `);
    return result.recordset[0];
}
async function listUserFaces(cpf) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const where = cpf ? "WHERE f.USUARIO_CPF = @USUARIO_CPF" : "";
    if (cpf) {
        request.input("USUARIO_CPF", db_1.sql.VarChar(100), cpf);
    }
    const result = await request.query(`
      SELECT
        f.ID,
        f.USUARIO_CPF,
        u.NOME AS USUARIO_NOME,
        f.DESCRIPTOR_JSON,
        f.FOTO_BASE64,
        f.FOTO_URL,
        f.ORIGEM,
        f.CRIADO_POR,
        f.CRIADO_EM
      FROM dbo.TUSUARIO_FACES f
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = f.USUARIO_CPF
      ${where}
      ORDER BY f.CRIADO_EM DESC
    `);
    return result.recordset;
}
async function listFaceDescriptorsForMatch(maxPerUser = 3) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request().input("MAX_PER_USER", db_1.sql.Int, maxPerUser);
    const result = await request.query(`
      WITH RANKED AS (
        SELECT
          f.ID,
          f.USUARIO_CPF,
          u.NOME AS USUARIO_NOME,
          f.DESCRIPTOR_JSON,
          f.CRIADO_EM,
          ROW_NUMBER() OVER (
            PARTITION BY f.USUARIO_CPF
            ORDER BY f.CRIADO_EM DESC
          ) AS RN
        FROM dbo.TUSUARIO_FACES f
        LEFT JOIN dbo.TUSUARIOS u ON u.CPF = f.USUARIO_CPF
      )
      SELECT
        ID,
        USUARIO_CPF,
        USUARIO_NOME,
        DESCRIPTOR_JSON,
        CRIADO_EM
      FROM RANKED
      WHERE RN <= @MAX_PER_USER
      ORDER BY CRIADO_EM DESC
    `);
    return result.recordset;
}
async function getLatestUserFaceByCpf(cpf) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
        .query(`
      SELECT TOP 1
        f.ID,
        f.USUARIO_CPF,
        u.NOME AS USUARIO_NOME,
        f.DESCRIPTOR_JSON,
        f.FOTO_BASE64,
        f.FOTO_URL,
        f.ORIGEM,
        f.CRIADO_POR,
        f.CRIADO_EM
      FROM dbo.TUSUARIO_FACES f
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = f.USUARIO_CPF
      WHERE f.USUARIO_CPF = @USUARIO_CPF
      ORDER BY f.CRIADO_EM DESC
    `);
    return result.recordset[0];
}
