import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type UserFaceRecord = {
  ID: string
  USUARIO_CPF: string
  USUARIO_NOME: string | null
  DESCRIPTOR_JSON: string
  FOTO_BASE64: string | null
  FOTO_URL: string | null
  ORIGEM: string | null
  CRIADO_POR: string | null
  CRIADO_EM: Date
}

export type CreateUserFaceInput = {
  cpf: string
  descriptorJson: string
  fotoBase64?: string | null
  fotoUrl?: string | null
  origem?: string | null
  criadoPor?: string | null
}

export async function createUserFace(input: CreateUserFaceInput) {
  const pool = await getPool()
  const existing = await pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), input.cpf)
    .query(`
      SELECT TOP 1 ID
      FROM dbo.TUSUARIO_FACES
      WHERE USUARIO_CPF = @USUARIO_CPF
      ORDER BY CRIADO_EM DESC
    `)

  const current = existing.recordset[0] as { ID: string } | undefined
  const id = current?.ID ?? randomUUID()

  if (current) {
    await pool
      .request()
      .input("ID", sql.UniqueIdentifier, id)
      .input("DESCRIPTOR_JSON", sql.NVarChar(sql.MAX), input.descriptorJson)
      .input("FOTO_BASE64", sql.NVarChar(sql.MAX), input.fotoBase64 ?? null)
      .input("FOTO_URL", sql.NVarChar(2000), input.fotoUrl ?? null)
      .input("ORIGEM", sql.VarChar(50), input.origem ?? null)
      .input("CRIADO_POR", sql.VarChar(100), input.criadoPor ?? null)
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
      `)
  } else {
    await pool
      .request()
      .input("ID", sql.UniqueIdentifier, id)
      .input("USUARIO_CPF", sql.VarChar(100), input.cpf)
      .input("DESCRIPTOR_JSON", sql.NVarChar(sql.MAX), input.descriptorJson)
      .input("FOTO_BASE64", sql.NVarChar(sql.MAX), input.fotoBase64 ?? null)
      .input("FOTO_URL", sql.NVarChar(2000), input.fotoUrl ?? null)
      .input("ORIGEM", sql.VarChar(50), input.origem ?? null)
      .input("CRIADO_POR", sql.VarChar(100), input.criadoPor ?? null)
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
      `)
  }

  await pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), input.cpf)
    .input("ID", sql.UniqueIdentifier, id)
    .query(`
      DELETE FROM dbo.TUSUARIO_FACES
      WHERE USUARIO_CPF = @USUARIO_CPF
        AND ID <> @ID
    `)

  const created = await getUserFaceById(id)
  return created
}

export async function getUserFaceById(id: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
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
    `)

  return result.recordset[0] as UserFaceRecord | undefined
}

export async function listUserFaces(cpf?: string) {
  const pool = await getPool()
  const request = pool.request()

  const where = cpf ? "WHERE f.USUARIO_CPF = @USUARIO_CPF" : ""
  if (cpf) {
    request.input("USUARIO_CPF", sql.VarChar(100), cpf)
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
    `)

  return result.recordset as UserFaceRecord[]
}

export async function listFaceDescriptorsForMatch(maxPerUser = 3) {
  const pool = await getPool()
  const request = pool.request().input("MAX_PER_USER", sql.Int, maxPerUser)
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
    `)

  return result.recordset as Array<{
    ID: string
    USUARIO_CPF: string
    USUARIO_NOME: string | null
    DESCRIPTOR_JSON: string
    CRIADO_EM: Date
  }>
}

export async function getLatestUserFaceByCpf(cpf: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), cpf)
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
    `)

  return result.recordset[0] as UserFaceRecord | undefined
}
