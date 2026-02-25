import { getPool, sql } from "../config/db"

export type ModuleRecord = {
  ID: string
  NOME: string
  QTD_TRILHAS: number | null
  CRIADO_POR: string | null
  PATH: string | null
  DURACAO_SEGUNDOS?: number | null
  DURACAO_HORAS?: number | null
}

export async function listModules() {
  const pool = await getPool()
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
  `)
  return result.recordset as ModuleRecord[]
}

export async function listModulesByUser(cpf: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), cpf)
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
    `)

  return result.recordset as ModuleRecord[]
}

export async function getModuleById(id: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("SELECT * FROM dbo.TMODULOS WHERE ID = @ID")

  return result.recordset[0] as ModuleRecord | undefined
}

export type ModuleCreateInput = {
  id: string
  nome: string
  qtdTrilhas?: number | null
  criadoPor?: string | null
  path?: string | null
}

export async function createModule(input: ModuleCreateInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("NOME", sql.NVarChar(255), input.nome)
    .input("QTD_TRILHAS", sql.Int, input.qtdTrilhas ?? 0)
    .input("CRIADO_POR", sql.NVarChar(255), input.criadoPor ?? null)
    .input("PATH", sql.NVarChar(500), input.path ?? null)
    .query(
      "INSERT INTO dbo.TMODULOS (ID, NOME, QTD_TRILHAS, CRIADO_POR, PATH) VALUES (@ID, @NOME, @QTD_TRILHAS, @CRIADO_POR, @PATH)",
    )

  return getModuleById(input.id)
}

export type ModuleUpdateInput = {
  nome?: string | null
  qtdTrilhas?: number | null
  criadoPor?: string | null
  path?: string | null
}

export async function updateModule(id: string, input: ModuleUpdateInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("NOME", sql.NVarChar(255), input.nome ?? null)
    .input("QTD_TRILHAS", sql.Int, input.qtdTrilhas ?? null)
    .input("CRIADO_POR", sql.NVarChar(255), input.criadoPor ?? null)
    .input("PATH", sql.NVarChar(500), input.path ?? null)
    .query(
      "UPDATE dbo.TMODULOS SET NOME = COALESCE(@NOME, NOME), QTD_TRILHAS = COALESCE(@QTD_TRILHAS, QTD_TRILHAS), CRIADO_POR = COALESCE(@CRIADO_POR, CRIADO_POR), PATH = COALESCE(@PATH, PATH) WHERE ID = @ID",
    )

  return getModuleById(id)
}

export async function deleteModule(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TMODULOS WHERE ID = @ID")
}
