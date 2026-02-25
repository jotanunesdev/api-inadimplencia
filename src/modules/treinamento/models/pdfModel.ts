import { getPool, sql } from "../config/db"

export type PdfRecord = {
  ID: string
  TRILHA_FK_ID: string
  PDF_PATH: string | null
  PROCEDIMENTO_ID: string | null
  NORMA_ID: string | null
  VERSAO: number
}

export async function listPdfs(trilhaId?: string, cpf?: string) {
  const pool = await getPool()
  const request = pool.request()
  const conditions: string[] = []
  let join = ""

  if (cpf) {
    request.input("USUARIO_CPF", sql.VarChar(100), cpf)
    join = "JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = p.TRILHA_FK_ID"
    conditions.push("ut.USUARIO_CPF = @USUARIO_CPF")
  }

  if (trilhaId) {
    request.input("TRILHA_FK_ID", sql.UniqueIdentifier, trilhaId)
    conditions.push("p.TRILHA_FK_ID = @TRILHA_FK_ID")
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await request.query(`
    SELECT ID, TRILHA_FK_ID, PDF_PATH, PROCEDIMENTO_ID, NORMA_ID, VERSAO
    FROM (
      SELECT
        p.ID,
        p.TRILHA_FK_ID,
        p.PDF_PATH,
        p.PROCEDIMENTO_ID,
        p.NORMA_ID,
        p.VERSAO,
        ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
      FROM dbo.TPDFS p
      ${join}
      ${where}
    ) p
    WHERE p.RN = 1
  `)

  return result.recordset as PdfRecord[]
}

export async function getPdfById(id: string, versao?: number) {
  const pool = await getPool()
  const request = pool.request().input("ID", sql.UniqueIdentifier, id)

  if (versao !== undefined) {
    request.input("VERSAO", sql.Int, versao)
    const result = await request.query(
      "SELECT * FROM dbo.TPDFS WHERE ID = @ID AND VERSAO = @VERSAO",
    )
    return result.recordset[0] as PdfRecord | undefined
  }

  const result = await request.query(
    "SELECT TOP 1 * FROM dbo.TPDFS WHERE ID = @ID ORDER BY VERSAO DESC",
  )
  return result.recordset[0] as PdfRecord | undefined
}

export type PdfCreateInput = {
  id: string
  trilhaId: string
  pdfPath: string
  procedimentoId?: string | null
  normaId?: string | null
}

export async function createPdf(input: PdfCreateInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("TRILHA_FK_ID", sql.UniqueIdentifier, input.trilhaId)
    .input("PDF_PATH", sql.NVarChar(1000), input.pdfPath)
    .input("PROCEDIMENTO_ID", sql.UniqueIdentifier, input.procedimentoId ?? null)
    .input("NORMA_ID", sql.UniqueIdentifier, input.normaId ?? null)
    .input("VERSAO", sql.Int, 1)
    .query(
      "INSERT INTO dbo.TPDFS (ID, TRILHA_FK_ID, PDF_PATH, PROCEDIMENTO_ID, NORMA_ID, VERSAO) VALUES (@ID, @TRILHA_FK_ID, @PDF_PATH, @PROCEDIMENTO_ID, @NORMA_ID, @VERSAO)",
    )

  return getPdfById(input.id)
}

export type PdfUpdateInput = {
  trilhaId?: string | null
  pdfPath?: string | null
  procedimentoId?: string | null
  normaId?: string | null
}

export async function updatePdf(id: string, input: PdfUpdateInput) {
  const pool = await getPool()
  const latestResult = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("SELECT TOP 1 * FROM dbo.TPDFS WHERE ID = @ID ORDER BY VERSAO DESC")

  const latest = latestResult.recordset[0] as PdfRecord | undefined
  if (!latest) {
    return undefined
  }

  const nextVersion = (latest.VERSAO ?? 0) + 1
  const trilhaId = input.trilhaId ?? latest.TRILHA_FK_ID
  const pdfPath = input.pdfPath ?? latest.PDF_PATH ?? ""
  const procedimentoId =
    input.procedimentoId !== undefined
      ? input.procedimentoId
      : latest.PROCEDIMENTO_ID
  const normaId =
    input.normaId !== undefined
      ? input.normaId
      : latest.NORMA_ID

  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("TRILHA_FK_ID", sql.UniqueIdentifier, trilhaId)
    .input("PDF_PATH", sql.NVarChar(1000), pdfPath)
    .input("PROCEDIMENTO_ID", sql.UniqueIdentifier, procedimentoId ?? null)
    .input("NORMA_ID", sql.UniqueIdentifier, normaId ?? null)
    .input("VERSAO", sql.Int, nextVersion)
    .query(
      "INSERT INTO dbo.TPDFS (ID, TRILHA_FK_ID, PDF_PATH, PROCEDIMENTO_ID, NORMA_ID, VERSAO) VALUES (@ID, @TRILHA_FK_ID, @PDF_PATH, @PROCEDIMENTO_ID, @NORMA_ID, @VERSAO)",
    )

  return getPdfById(id)
}

export async function deletePdf(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TPDFS WHERE ID = @ID")
}
