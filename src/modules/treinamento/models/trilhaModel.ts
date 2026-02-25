import { getPool, sql } from "../config/db"

export type TrilhaRecord = {
  ID: string
  MODULO_FK_ID: string
  TITULO: string
  CRIADO_POR: string | null
  ATUALIZADO_EM: Date | null
  PATH: string | null
  AVALIACAO_EFICACIA_OBRIGATORIA?: boolean | number | null
  AVALIACAO_EFICACIA_PERGUNTA?: string | null
  AVALIACAO_EFICACIA_ATUALIZADA_EM?: Date | null
  DURACAO_SEGUNDOS?: number | null
  DURACAO_HORAS?: number | null
}

async function ensureTrilhaEficaciaColumns() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.TTRILHAS', 'AVALIACAO_EFICACIA_OBRIGATORIA') AS OBRIGATORIA_COL,
      COL_LENGTH('dbo.TTRILHAS', 'AVALIACAO_EFICACIA_PERGUNTA') AS PERGUNTA_COL,
      COL_LENGTH('dbo.TTRILHAS', 'AVALIACAO_EFICACIA_ATUALIZADA_EM') AS ATUALIZADA_EM_COL
  `)

  const row = result.recordset[0] as
    | {
        OBRIGATORIA_COL?: number | null
        PERGUNTA_COL?: number | null
        ATUALIZADA_EM_COL?: number | null
      }
    | undefined

  if (!row?.OBRIGATORIA_COL || !row?.PERGUNTA_COL || !row?.ATUALIZADA_EM_COL) {
    const error = new Error("Colunas de avaliacao de eficacia da trilha ausentes")
    ;(error as Error & { code?: string }).code = "TRILHA_EFICACIA_CONFIG_COLUMNS_MISSING"
    throw error
  }
}

export async function listTrilhasByModulo(moduloId: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("MODULO_FK_ID", sql.UniqueIdentifier, moduloId)
    .query(`
      SELECT t.*,
        COALESCE(d.TOTAL_SEGUNDOS, 0) AS DURACAO_SEGUNDOS,
        CAST(COALESCE(d.TOTAL_SEGUNDOS, 0) / 3600.0 AS DECIMAL(10, 2)) AS DURACAO_HORAS
      FROM dbo.TTRILHAS t
      LEFT JOIN (
        SELECT v.TRILHA_FK_ID, SUM(ISNULL(v.DURACAO_SEGUNDOS, 0)) AS TOTAL_SEGUNDOS
        FROM (
          SELECT
            ID,
            TRILHA_FK_ID,
            DURACAO_SEGUNDOS,
            ROW_NUMBER() OVER (PARTITION BY ID ORDER BY VERSAO DESC) AS RN
          FROM dbo.TVIDEOS
        ) v
        WHERE v.RN = 1
        GROUP BY v.TRILHA_FK_ID
      ) d ON d.TRILHA_FK_ID = t.ID
      WHERE t.MODULO_FK_ID = @MODULO_FK_ID
    `)

  return result.recordset as TrilhaRecord[]
}

export async function listTrilhasByUser(cpf: string, moduloId?: string) {
  const pool = await getPool()
  const request = pool.request().input("USUARIO_CPF", sql.VarChar(100), cpf)
  let query = `
    SELECT t.*,
      COALESCE(d.TOTAL_SEGUNDOS, 0) AS DURACAO_SEGUNDOS,
      CAST(COALESCE(d.TOTAL_SEGUNDOS, 0) / 3600.0 AS DECIMAL(10, 2)) AS DURACAO_HORAS
    FROM dbo.TTRILHAS t
    JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = t.ID
    LEFT JOIN (
      SELECT v.TRILHA_FK_ID, SUM(ISNULL(v.DURACAO_SEGUNDOS, 0)) AS TOTAL_SEGUNDOS
      FROM (
        SELECT
          ID,
          TRILHA_FK_ID,
          DURACAO_SEGUNDOS,
          ROW_NUMBER() OVER (PARTITION BY ID ORDER BY VERSAO DESC) AS RN
        FROM dbo.TVIDEOS
      ) v
      WHERE v.RN = 1
      GROUP BY v.TRILHA_FK_ID
    ) d ON d.TRILHA_FK_ID = t.ID
    WHERE ut.USUARIO_CPF = @USUARIO_CPF
  `

  if (moduloId) {
    request.input("MODULO_FK_ID", sql.UniqueIdentifier, moduloId)
    query += " AND t.MODULO_FK_ID = @MODULO_FK_ID"
  }

  const result = await request.query(query)
  return result.recordset as TrilhaRecord[]
}

export async function getTrilhaById(id: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("SELECT * FROM dbo.TTRILHAS WHERE ID = @ID")

  return result.recordset[0] as TrilhaRecord | undefined
}

export async function trilhaHasEficaciaConfig(trilhaId: string) {
  await ensureTrilhaEficaciaColumns()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, trilhaId)
    .query(`
      SELECT TOP 1
        CASE
          WHEN ISNULL(AVALIACAO_EFICACIA_OBRIGATORIA, 0) = 1
               AND NULLIF(LTRIM(RTRIM(ISNULL(AVALIACAO_EFICACIA_PERGUNTA, ''))), '') IS NOT NULL
          THEN CAST(1 AS BIT)
          ELSE CAST(0 AS BIT)
        END AS POSSUI
      FROM dbo.TTRILHAS
      WHERE ID = @ID
    `)

  const row = result.recordset[0] as { POSSUI?: boolean | number | null } | undefined
  if (!row) return false
  return row.POSSUI === true || Number(row.POSSUI ?? 0) === 1
}

export type TrilhaEficaciaConfigInput = {
  pergunta: string
  obrigatoria?: boolean | null
  atualizadoEm?: Date | null
}

export async function upsertTrilhaEficaciaConfig(
  trilhaId: string,
  input: TrilhaEficaciaConfigInput,
) {
  await ensureTrilhaEficaciaColumns()
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, trilhaId)
    .input(
      "AVALIACAO_EFICACIA_OBRIGATORIA",
      sql.Bit,
      input.obrigatoria === false ? false : true,
    )
    .input("AVALIACAO_EFICACIA_PERGUNTA", sql.NVarChar(sql.MAX), input.pergunta)
    .input(
      "AVALIACAO_EFICACIA_ATUALIZADA_EM",
      sql.DateTime2,
      input.atualizadoEm ?? new Date(),
    )
    .query(`
      UPDATE dbo.TTRILHAS
      SET
        AVALIACAO_EFICACIA_OBRIGATORIA = @AVALIACAO_EFICACIA_OBRIGATORIA,
        AVALIACAO_EFICACIA_PERGUNTA = @AVALIACAO_EFICACIA_PERGUNTA,
        AVALIACAO_EFICACIA_ATUALIZADA_EM = @AVALIACAO_EFICACIA_ATUALIZADA_EM
      WHERE ID = @ID
    `)

  return getTrilhaById(trilhaId)
}

export type TrilhaCreateInput = {
  id: string
  moduloId: string
  titulo: string
  criadoPor?: string | null
  atualizadoEm?: Date | null
  path?: string | null
}

export async function createTrilha(input: TrilhaCreateInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("MODULO_FK_ID", sql.UniqueIdentifier, input.moduloId)
    .input("TITULO", sql.NVarChar(255), input.titulo)
    .input("CRIADO_POR", sql.NVarChar(255), input.criadoPor ?? null)
    .input("ATUALIZADO_EM", sql.DateTime2, input.atualizadoEm ?? null)
    .input("PATH", sql.NVarChar(500), input.path ?? null)
    .query(
      "INSERT INTO dbo.TTRILHAS (ID, MODULO_FK_ID, TITULO, CRIADO_POR, ATUALIZADO_EM, PATH) VALUES (@ID, @MODULO_FK_ID, @TITULO, @CRIADO_POR, @ATUALIZADO_EM, @PATH)",
    )

  return getTrilhaById(input.id)
}

export type TrilhaUpdateInput = {
  moduloId?: string | null
  titulo?: string | null
  criadoPor?: string | null
  atualizadoEm?: Date | null
  path?: string | null
}

export async function updateTrilha(id: string, input: TrilhaUpdateInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("MODULO_FK_ID", sql.UniqueIdentifier, input.moduloId ?? null)
    .input("TITULO", sql.NVarChar(255), input.titulo ?? null)
    .input("CRIADO_POR", sql.NVarChar(255), input.criadoPor ?? null)
    .input("ATUALIZADO_EM", sql.DateTime2, input.atualizadoEm ?? null)
    .input("PATH", sql.NVarChar(500), input.path ?? null)
    .query(
      "UPDATE dbo.TTRILHAS SET MODULO_FK_ID = COALESCE(@MODULO_FK_ID, MODULO_FK_ID), TITULO = COALESCE(@TITULO, TITULO), CRIADO_POR = COALESCE(@CRIADO_POR, CRIADO_POR), ATUALIZADO_EM = COALESCE(@ATUALIZADO_EM, ATUALIZADO_EM), PATH = COALESCE(@PATH, PATH) WHERE ID = @ID",
    )

  return getTrilhaById(id)
}

export async function deleteTrilha(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TTRILHAS WHERE ID = @ID")
}
