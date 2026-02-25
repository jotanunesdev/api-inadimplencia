import { getPool, sql } from "../config/db"

export type ProcedimentoRecord = {
  ID: string
  NOME: string
  PATH_PDF: string
  OBSERVACOES: string | null
  VERSAO: number
  ALTERADO_EM: Date
}

export type ProcedimentoLinkedMaterial = {
  TIPO: "video" | "pdf"
  MATERIAL_ID: string
  TRILHA_ID: string
}

export async function listProcedimentos() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT ID, NOME, PATH_PDF, OBSERVACOES, VERSAO, ALTERADO_EM
    FROM (
      SELECT
        p.ID,
        p.NOME,
        p.PATH_PDF,
        p.OBSERVACOES,
        p.VERSAO,
        p.ALTERADO_EM,
        ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
      FROM dbo.TPROCEDIMENTOS p
    ) p
    WHERE p.RN = 1
    ORDER BY p.NOME
  `)

  return result.recordset as ProcedimentoRecord[]
}

export async function getProcedimentoById(id: string, versao?: number) {
  const pool = await getPool()
  const request = pool.request().input("ID", sql.UniqueIdentifier, id)

  if (versao !== undefined) {
    request.input("VERSAO", sql.Int, versao)
    const result = await request.query(
      "SELECT * FROM dbo.TPROCEDIMENTOS WHERE ID = @ID AND VERSAO = @VERSAO",
    )
    return result.recordset[0] as ProcedimentoRecord | undefined
  }

  const result = await request.query(
    "SELECT TOP 1 * FROM dbo.TPROCEDIMENTOS WHERE ID = @ID ORDER BY VERSAO DESC",
  )
  return result.recordset[0] as ProcedimentoRecord | undefined
}

export async function listProcedimentoVersionsById(id: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query(`
      SELECT ID, NOME, PATH_PDF, OBSERVACOES, VERSAO, ALTERADO_EM
      FROM dbo.TPROCEDIMENTOS
      WHERE ID = @ID
      ORDER BY VERSAO DESC
    `)

  return result.recordset as ProcedimentoRecord[]
}

export type ProcedimentoCreateInput = {
  id: string
  nome: string
  pathPdf: string
  observacoes?: string | null
  versao?: number | null
  alteradoEm?: Date | null
}

export async function createProcedimento(input: ProcedimentoCreateInput) {
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
    .input("ALTERADO_EM", sql.DateTime2, input.alteradoEm ?? new Date())
    .query(`
      INSERT INTO dbo.TPROCEDIMENTOS (
        ID,
        NOME,
        PATH_PDF,
        OBSERVACOES,
        VERSAO,
        ALTERADO_EM
      )
      VALUES (
        @ID,
        @NOME,
        @PATH_PDF,
        @OBSERVACOES,
        @VERSAO,
        @ALTERADO_EM
      )
    `)

  return getProcedimentoById(input.id, normalizedVersion)
}

export type ProcedimentoUpdateInput = {
  nome?: string | null
  pathPdf?: string | null
  observacoes?: string | null
  versao?: number | null
  alteradoEm?: Date | null
}

export async function updateProcedimento(id: string, input: ProcedimentoUpdateInput) {
  const latest = await getProcedimentoById(id)
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

  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("NOME", sql.NVarChar(255), nome)
    .input("PATH_PDF", sql.NVarChar(1000), pathPdf)
    .input("OBSERVACOES", sql.NVarChar(sql.MAX), observacoes)
    .input("VERSAO", sql.Int, nextVersion)
    .input("ALTERADO_EM", sql.DateTime2, input.alteradoEm ?? new Date())
    .query(`
      INSERT INTO dbo.TPROCEDIMENTOS (
        ID,
        NOME,
        PATH_PDF,
        OBSERVACOES,
        VERSAO,
        ALTERADO_EM
      )
      VALUES (
        @ID,
        @NOME,
        @PATH_PDF,
        @OBSERVACOES,
        @VERSAO,
        @ALTERADO_EM
      )
    `)

  return getProcedimentoById(id, nextVersion)
}

export async function deleteProcedimento(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TPROCEDIMENTOS WHERE ID = @ID")
}

export async function listLinkedMaterialsByProcedimento(
  procedimentoId: string,
) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("PROCEDIMENTO_ID", sql.UniqueIdentifier, procedimentoId)
    .query(`
      WITH V_LATEST AS (
        SELECT
          v.ID,
          v.TRILHA_FK_ID,
          v.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
      ),
      P_LATEST AS (
        SELECT
          p.ID,
          p.TRILHA_FK_ID,
          p.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPDFS p
      )
      SELECT
        CAST('video' AS VARCHAR(10)) AS TIPO,
        v.ID AS MATERIAL_ID,
        v.TRILHA_FK_ID AS TRILHA_ID
      FROM V_LATEST v
      WHERE v.RN = 1
        AND v.PROCEDIMENTO_ID = @PROCEDIMENTO_ID

      UNION ALL

      SELECT
        CAST('pdf' AS VARCHAR(10)) AS TIPO,
        p.ID AS MATERIAL_ID,
        p.TRILHA_FK_ID AS TRILHA_ID
      FROM P_LATEST p
      WHERE p.RN = 1
        AND p.PROCEDIMENTO_ID = @PROCEDIMENTO_ID
    `)

  return result.recordset as ProcedimentoLinkedMaterial[]
}
