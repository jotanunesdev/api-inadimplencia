import { getPool, sql } from "../config/db"

export type UserRecord = {
  CPF: string
  NOME: string | null
  IDADE: number | null
  SEXO: string | null
  NOMEFILIAL: string | null
  DTNASCIMENTO: Date | null
  HASH_SENHA: string | null
  QTD_CURSOS_REALIZADOS: number | null
  HORAS_CURSOS_REALIZADOS: number | null
  CARGO: string | null
  SETOR: string | null
  ATIVO: boolean | null
  PERMISSAO: string | null
  READVIEW_JSON: string | null
  INSTRUTOR: boolean | null
}

export async function getUserByCpf(cpf: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("CPF", sql.VarChar(100), cpf)
    .query("SELECT * FROM dbo.TUSUARIOS WHERE CPF = @CPF")

  return result.recordset[0] as UserRecord | undefined
}

export type UpsertUserInput = {
  cpf: string
  nome?: string | null
  idade?: number | null
  sexo?: string | null
  nomeFilial?: string | null
  dtNascimento?: Date | null
  cargo?: string | null
  setor?: string | null
  ativo?: boolean | null
  permissao?: string | null
  hashSenha?: string | null
  readViewJson?: string | null
  instrutor?: boolean | null
}

export async function upsertUser(input: UpsertUserInput) {
  const pool = await getPool()

  await pool
    .request()
    .input("CPF", sql.VarChar(100), input.cpf)
    .input("NOME", sql.VarChar(100), input.nome ?? null)
    .input("IDADE", sql.Int, input.idade ?? null)
    .input("SEXO", sql.VarChar(15), input.sexo ?? null)
    .input("NOMEFILIAL", sql.VarChar(255), input.nomeFilial ?? null)
    .input("DTNASCIMENTO", sql.Date, input.dtNascimento ?? null)
    .input("CARGO", sql.VarChar(250), input.cargo ?? null)
    .input("SETOR", sql.VarChar(255), input.setor ?? null)
    .input("ATIVO", sql.Bit, input.ativo ?? null)
    .input("PERMISSAO", sql.VarChar(255), input.permissao ?? null)
    .input("HASH_SENHA", sql.VarChar(255), input.hashSenha ?? null)
    .input("READVIEW_JSON", sql.NVarChar(sql.MAX), input.readViewJson ?? null)
    .input("INSTRUTOR", sql.Bit, input.instrutor ?? null)
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
    `)

  const user = await getUserByCpf(input.cpf)
  return user
}

export async function updateUserPassword(cpf: string, hash: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("CPF", sql.VarChar(100), cpf)
    .input("HASH_SENHA", sql.VarChar(255), hash)
    .query("UPDATE dbo.TUSUARIOS SET HASH_SENHA = @HASH_SENHA WHERE CPF = @CPF")

  return getUserByCpf(cpf)
}

export type InstructorRecord = {
  CPF: string
  NOME: string | null
  CARGO: string | null
  SETOR: string | null
  INSTRUTOR: boolean | null
}

export type UserListRecord = {
  CPF: string
  NOME: string | null
  CARGO: string | null
  SETOR: string | null
  ATIVO: boolean | null
  INSTRUTOR: boolean | null
}

export async function listUsers(filters?: {
  cpf?: string
  nome?: string
  ativo?: boolean
  instrutor?: boolean
}) {
  const pool = await getPool()
  const request = pool.request()
  const conditions: string[] = []

  if (filters?.cpf) {
    request.input("CPF", sql.VarChar(100), `%${filters.cpf}%`)
    conditions.push("CPF LIKE @CPF")
  }

  if (filters?.nome) {
    request.input("NOME", sql.VarChar(255), `%${filters.nome}%`)
    conditions.push("NOME LIKE @NOME")
  }

  if (filters?.ativo !== undefined) {
    request.input("ATIVO", sql.Bit, filters.ativo ? 1 : 0)
    conditions.push("ATIVO = @ATIVO")
  }

  if (filters?.instrutor !== undefined) {
    request.input("INSTRUTOR", sql.Bit, filters.instrutor ? 1 : 0)
    conditions.push("INSTRUTOR = @INSTRUTOR")
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  const result = await request.query(`
    SELECT CPF, NOME, CARGO, SETOR, ATIVO, INSTRUTOR
    FROM dbo.TUSUARIOS
    ${where}
    ORDER BY NOME
  `)

  return result.recordset as UserListRecord[]
}

export async function listInstructors() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT CPF, NOME, CARGO, SETOR, INSTRUTOR
    FROM dbo.TUSUARIOS
    WHERE INSTRUTOR = 1
    ORDER BY NOME
  `)

  return result.recordset as InstructorRecord[]
}

export async function setInstructorFlag(cpf: string, isInstructor: boolean) {
  const pool = await getPool()
  await pool
    .request()
    .input("CPF", sql.VarChar(100), cpf)
    .input("INSTRUTOR", sql.Bit, isInstructor ? 1 : 0)
    .query(`
      UPDATE dbo.TUSUARIOS
      SET INSTRUTOR = @INSTRUTOR
      WHERE CPF = @CPF
    `)
}

export async function clearAllInstructors() {
  const pool = await getPool()
  await pool.request().query(`
    UPDATE dbo.TUSUARIOS
    SET INSTRUTOR = 0
    WHERE INSTRUTOR = 1
  `)
}
