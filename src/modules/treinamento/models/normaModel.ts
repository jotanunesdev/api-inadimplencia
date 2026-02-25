import { getPool, sql } from "../config/db"

export type NormaRecord = {
  ID: string
  NOME: string
  PATH_PDF: string
  OBSERVACOES: string | null
  VERSAO: number
  VALIDADE_MESES: number
  VALIDADE_ANOS: number
  ALTERADO_EM: Date
}

export async function listNormas() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT ID, NOME, PATH_PDF, OBSERVACOES, VERSAO, VALIDADE_MESES, VALIDADE_ANOS, ALTERADO_EM
    FROM (
      SELECT
        n.ID,
        n.NOME,
        n.PATH_PDF,
        n.OBSERVACOES,
        n.VERSAO,
        n.VALIDADE_MESES,
        n.VALIDADE_ANOS,
        n.ALTERADO_EM,
        ROW_NUMBER() OVER (PARTITION BY n.ID ORDER BY n.VERSAO DESC) AS RN
      FROM dbo.TNORMAS n
    ) n
    WHERE n.RN = 1
    ORDER BY n.NOME
  `)

  return result.recordset as NormaRecord[]
}

export async function getNormaById(id: string, versao?: number) {
  const pool = await getPool()
  const request = pool.request().input("ID", sql.UniqueIdentifier, id)

  if (versao !== undefined) {
    request.input("VERSAO", sql.Int, versao)
    const result = await request.query(
      "SELECT * FROM dbo.TNORMAS WHERE ID = @ID AND VERSAO = @VERSAO",
    )
    return result.recordset[0] as NormaRecord | undefined
  }

  const result = await request.query(
    "SELECT TOP 1 * FROM dbo.TNORMAS WHERE ID = @ID ORDER BY VERSAO DESC",
  )
  return result.recordset[0] as NormaRecord | undefined
}

export async function listNormaVersionsById(id: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query(`
      SELECT ID, NOME, PATH_PDF, OBSERVACOES, VERSAO, VALIDADE_MESES, VALIDADE_ANOS, ALTERADO_EM
      FROM dbo.TNORMAS
      WHERE ID = @ID
      ORDER BY VERSAO DESC
    `)

  return result.recordset as NormaRecord[]
}

export type NormaCreateInput = {
  id: string
  nome: string
  pathPdf: string
  observacoes?: string | null
  versao?: number | null
  validadeMeses: number
  validadeAnos: number
  alteradoEm?: Date | null
}

export async function createNorma(input: NormaCreateInput) {
  const pool = await getPool()
  const normalizedVersion =
    input.versao !== undefined && input.versao !== null
      ? Math.max(1, Math.trunc(input.versao))
      : 1

  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("NOME", sql.NVarChar(255), input.nome)
    .input("PATH_PDF", sql.NVarChar(1000), input.pathPdf)
    .input("OBSERVACOES", sql.NVarChar(sql.MAX), input.observacoes ?? null)
    .input("VERSAO", sql.Int, normalizedVersion)
    .input("VALIDADE_MESES", sql.TinyInt, input.validadeMeses)
    .input("VALIDADE_ANOS", sql.TinyInt, input.validadeAnos)
    .input("ALTERADO_EM", sql.DateTime2, input.alteradoEm ?? new Date())
    .query(`
      INSERT INTO dbo.TNORMAS (
        ID,
        NOME,
        PATH_PDF,
        OBSERVACOES,
        VERSAO,
        VALIDADE_MESES,
        VALIDADE_ANOS,
        ALTERADO_EM
      )
      VALUES (
        @ID,
        @NOME,
        @PATH_PDF,
        @OBSERVACOES,
        @VERSAO,
        @VALIDADE_MESES,
        @VALIDADE_ANOS,
        @ALTERADO_EM
      )
    `)

  return getNormaById(input.id, normalizedVersion)
}

export type NormaUpdateInput = {
  nome?: string | null
  pathPdf?: string | null
  observacoes?: string | null
  versao?: number | null
  validadeMeses?: number | null
  validadeAnos?: number | null
  alteradoEm?: Date | null
}

export async function updateNorma(id: string, input: NormaUpdateInput) {
  const latest = await getNormaById(id)
  if (!latest) {
    return undefined
  }

  const requestedVersion =
    input.versao !== undefined && input.versao !== null
      ? Math.max(1, Math.trunc(input.versao))
      : null
  const nextVersion =
    requestedVersion !== null
      ? Math.max(requestedVersion, (latest.VERSAO ?? 0) + 1)
      : (latest.VERSAO ?? 0) + 1

  const nome = input.nome?.trim() || latest.NOME
  const pathPdf = input.pathPdf?.trim() || latest.PATH_PDF
  const observacoes =
    input.observacoes !== undefined ? input.observacoes : (latest.OBSERVACOES ?? null)
  const validadeMeses = input.validadeMeses ?? latest.VALIDADE_MESES
  const validadeAnos = input.validadeAnos ?? latest.VALIDADE_ANOS

  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("NOME", sql.NVarChar(255), nome)
    .input("PATH_PDF", sql.NVarChar(1000), pathPdf)
    .input("OBSERVACOES", sql.NVarChar(sql.MAX), observacoes)
    .input("VERSAO", sql.Int, nextVersion)
    .input("VALIDADE_MESES", sql.TinyInt, validadeMeses)
    .input("VALIDADE_ANOS", sql.TinyInt, validadeAnos)
    .input("ALTERADO_EM", sql.DateTime2, input.alteradoEm ?? new Date())
    .query(`
      INSERT INTO dbo.TNORMAS (
        ID,
        NOME,
        PATH_PDF,
        OBSERVACOES,
        VERSAO,
        VALIDADE_MESES,
        VALIDADE_ANOS,
        ALTERADO_EM
      )
      VALUES (
        @ID,
        @NOME,
        @PATH_PDF,
        @OBSERVACOES,
        @VERSAO,
        @VALIDADE_MESES,
        @VALIDADE_ANOS,
        @ALTERADO_EM
      )
    `)

  return getNormaById(id, nextVersion)
}

export async function deleteNorma(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TNORMAS WHERE ID = @ID")
}
