import { getPool, sql } from "../config/db"
import { hasTrilhaShareTable } from "./trilhaShareModel"

export type TrilhaRecord = {
  ID: string
  MODULO_FK_ID: string
  TITULO: string
  CRIADO_POR: string | null
  ATUALIZADO_EM: Date | null
  PATH: string | null
  DESCRICAO?: string | null
  PROCEDIMENTO_ID?: string | null
  NORMA_ID?: string | null
  AVALIACAO_EFICACIA_OBRIGATORIA?: boolean | number | null
  AVALIACAO_EFICACIA_PERGUNTA?: string | null
  AVALIACAO_EFICACIA_ATUALIZADA_EM?: Date | null
  DURACAO_SEGUNDOS?: number | null
  DURACAO_HORAS?: number | null
  TOTAL_ATRIBUIDOS?: number | null
  TOTAL_CONCLUIDOS?: number | null
  ACESSO_COMPARTILHADO?: boolean | number | null
}

type TrilhaColumnState = {
  hasDescricao: boolean
  hasEficaciaAtualizadaEm: boolean
  hasEficaciaObrigatoria: boolean
  hasEficaciaPergunta: boolean
  hasNormaId: boolean
  hasProcedimentoId: boolean
}

export async function getTrilhaColumnState(): Promise<TrilhaColumnState> {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.TTRILHAS', 'DESCRICAO') AS DESCRICAO_COL,
      COL_LENGTH('dbo.TTRILHAS', 'PROCEDIMENTO_ID') AS PROCEDIMENTO_ID_COL,
      COL_LENGTH('dbo.TTRILHAS', 'NORMA_ID') AS NORMA_ID_COL,
      COL_LENGTH('dbo.TTRILHAS', 'AVALIACAO_EFICACIA_OBRIGATORIA') AS OBRIGATORIA_COL,
      COL_LENGTH('dbo.TTRILHAS', 'AVALIACAO_EFICACIA_PERGUNTA') AS PERGUNTA_COL,
      COL_LENGTH('dbo.TTRILHAS', 'AVALIACAO_EFICACIA_ATUALIZADA_EM') AS ATUALIZADA_EM_COL
  `)

  const row = result.recordset[0] as
    | {
        DESCRICAO_COL?: number | null
        PROCEDIMENTO_ID_COL?: number | null
        NORMA_ID_COL?: number | null
        OBRIGATORIA_COL?: number | null
        PERGUNTA_COL?: number | null
        ATUALIZADA_EM_COL?: number | null
      }
    | undefined

  return {
    hasDescricao: Boolean(row?.DESCRICAO_COL),
    hasEficaciaAtualizadaEm: Boolean(row?.ATUALIZADA_EM_COL),
    hasEficaciaObrigatoria: Boolean(row?.OBRIGATORIA_COL),
    hasEficaciaPergunta: Boolean(row?.PERGUNTA_COL),
    hasNormaId: Boolean(row?.NORMA_ID_COL),
    hasProcedimentoId: Boolean(row?.PROCEDIMENTO_ID_COL),
  }
}

async function ensureTrilhaEficaciaColumns() {
  const columnState = await getTrilhaColumnState()
  if (
    !columnState.hasEficaciaObrigatoria ||
    !columnState.hasEficaciaPergunta ||
    !columnState.hasEficaciaAtualizadaEm
  ) {
    const error = new Error("Colunas de avaliacao de eficacia da trilha ausentes")
    ;(error as Error & { code?: string }).code = "TRILHA_EFICACIA_CONFIG_COLUMNS_MISSING"
    throw error
  }
}

function buildTrilhaSelectFragment(columnState: TrilhaColumnState) {
  const fragments = ["t.*"]

  if (!columnState.hasDescricao) {
    fragments.push("CAST(NULL AS NVARCHAR(MAX)) AS DESCRICAO")
  }

  if (!columnState.hasProcedimentoId) {
    fragments.push("CAST(NULL AS UNIQUEIDENTIFIER) AS PROCEDIMENTO_ID")
  }

  if (!columnState.hasNormaId) {
    fragments.push("CAST(NULL AS UNIQUEIDENTIFIER) AS NORMA_ID")
  }

  return fragments.join(", ")
}

const TRILHA_DURATION_JOIN = `
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
`

const TRILHA_ASSIGNMENT_COUNT_JOIN = `
  LEFT JOIN (
    SELECT ut.TRILHA_ID, COUNT(DISTINCT ut.USUARIO_CPF) AS TOTAL_ATRIBUIDOS
    FROM dbo.TUSUARIO_TRILHAS ut
    GROUP BY ut.TRILHA_ID
  ) a ON a.TRILHA_ID = t.ID
`

const TRILHA_COMPLETION_COUNT_JOIN = `
  LEFT JOIN (
    SELECT completed.TRILHA_ID, COUNT(*) AS TOTAL_CONCLUIDOS
    FROM (
      SELECT DISTINCT ut.TRILHA_ID, ut.USUARIO_CPF
      FROM dbo.TUSUARIO_TRILHAS ut
      JOIN dbo.TUSUARIO_PROVA_TENTATIVAS pa
        ON pa.TRILHA_ID = ut.TRILHA_ID
       AND pa.USUARIO_CPF = ut.USUARIO_CPF
    ) completed
    GROUP BY completed.TRILHA_ID
  ) c ON c.TRILHA_ID = t.ID
`

export async function listTrilhasByModulo(moduloId: string) {
  const columnState = await getTrilhaColumnState()
  const hasShareTable = await hasTrilhaShareTable()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("MODULO_FK_ID", sql.UniqueIdentifier, moduloId)
    .query(`
      SELECT ${buildTrilhaSelectFragment(columnState)},
        COALESCE(d.TOTAL_SEGUNDOS, 0) AS DURACAO_SEGUNDOS,
        CAST(COALESCE(d.TOTAL_SEGUNDOS, 0) / 3600.0 AS DECIMAL(10, 2)) AS DURACAO_HORAS,
        COALESCE(a.TOTAL_ATRIBUIDOS, 0) AS TOTAL_ATRIBUIDOS,
        COALESCE(c.TOTAL_CONCLUIDOS, 0) AS TOTAL_CONCLUIDOS,
        CAST(CASE WHEN t.MODULO_FK_ID = @MODULO_FK_ID THEN 0 ELSE 1 END AS BIT) AS ACESSO_COMPARTILHADO
      FROM dbo.TTRILHAS t
      ${TRILHA_DURATION_JOIN}
      ${TRILHA_ASSIGNMENT_COUNT_JOIN}
      ${TRILHA_COMPLETION_COUNT_JOIN}
      WHERE t.MODULO_FK_ID = @MODULO_FK_ID
        ${hasShareTable
          ? `OR EXISTS (
              SELECT 1
              FROM dbo.TTRILHA_SETOR_COMPARTILHAMENTOS share
              WHERE share.TRILHA_ID = t.ID
                AND share.MODULO_DESTINO_ID = @MODULO_FK_ID
            )`
          : ""}
    `)

  return result.recordset as TrilhaRecord[]
}

export async function listTrilhasByUser(cpf: string, moduloId?: string) {
  const columnState = await getTrilhaColumnState()
  const pool = await getPool()
  const request = pool.request().input("USUARIO_CPF", sql.VarChar(100), cpf)
  let query = `
    SELECT ${buildTrilhaSelectFragment(columnState)},
      COALESCE(d.TOTAL_SEGUNDOS, 0) AS DURACAO_SEGUNDOS,
      CAST(COALESCE(d.TOTAL_SEGUNDOS, 0) / 3600.0 AS DECIMAL(10, 2)) AS DURACAO_HORAS,
      COALESCE(a.TOTAL_ATRIBUIDOS, 0) AS TOTAL_ATRIBUIDOS,
      COALESCE(c.TOTAL_CONCLUIDOS, 0) AS TOTAL_CONCLUIDOS
    FROM dbo.TTRILHAS t
    JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = t.ID
    ${TRILHA_DURATION_JOIN}
    ${TRILHA_ASSIGNMENT_COUNT_JOIN}
    ${TRILHA_COMPLETION_COUNT_JOIN}
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
  const columnState = await getTrilhaColumnState()
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query(`
      SELECT ${buildTrilhaSelectFragment(columnState)},
        COALESCE(a.TOTAL_ATRIBUIDOS, 0) AS TOTAL_ATRIBUIDOS,
        COALESCE(c.TOTAL_CONCLUIDOS, 0) AS TOTAL_CONCLUIDOS
      FROM dbo.TTRILHAS t
      ${TRILHA_ASSIGNMENT_COUNT_JOIN}
      ${TRILHA_COMPLETION_COUNT_JOIN}
      WHERE t.ID = @ID
    `)

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
          WHEN NULLIF(LTRIM(RTRIM(ISNULL(AVALIACAO_EFICACIA_PERGUNTA, ''))), '') IS NOT NULL
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

export async function clearTrilhaEficaciaConfig(trilhaId: string) {
  await ensureTrilhaEficaciaColumns()
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, trilhaId)
    .query(`
      UPDATE dbo.TTRILHAS
      SET
        AVALIACAO_EFICACIA_OBRIGATORIA = 0,
        AVALIACAO_EFICACIA_PERGUNTA = NULL,
        AVALIACAO_EFICACIA_ATUALIZADA_EM = SYSUTCDATETIME()
      WHERE ID = @ID
    `)

  return getTrilhaById(trilhaId)
}

export type TrilhaCreateInput = {
  id: string
  moduloId: string
  titulo: string
  criadoPor?: string | null
  descricao?: string | null
  procedimentoId?: string | null
  normaId?: string | null
  atualizadoEm?: Date | null
  path?: string | null
}

export async function createTrilha(input: TrilhaCreateInput) {
  const columnState = await getTrilhaColumnState()
  const pool = await getPool()
  const request = pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("MODULO_FK_ID", sql.UniqueIdentifier, input.moduloId)
    .input("TITULO", sql.NVarChar(255), input.titulo)
    .input("CRIADO_POR", sql.NVarChar(255), input.criadoPor ?? null)
    .input("ATUALIZADO_EM", sql.DateTime2, input.atualizadoEm ?? null)
    .input("PATH", sql.NVarChar(500), input.path ?? null)

  if (columnState.hasDescricao) {
    request.input("DESCRICAO", sql.NVarChar(sql.MAX), input.descricao ?? null)
  }

  if (columnState.hasProcedimentoId) {
    request.input("PROCEDIMENTO_ID", sql.UniqueIdentifier, input.procedimentoId ?? null)
  }

  if (columnState.hasNormaId) {
    request.input("NORMA_ID", sql.UniqueIdentifier, input.normaId ?? null)
  }

  await request.query(
    `
      INSERT INTO dbo.TTRILHAS (
        ID,
        MODULO_FK_ID,
        TITULO,
        CRIADO_POR,
        ${columnState.hasDescricao ? "DESCRICAO," : ""}
        ${columnState.hasProcedimentoId ? "PROCEDIMENTO_ID," : ""}
        ${columnState.hasNormaId ? "NORMA_ID," : ""}
        ATUALIZADO_EM,
        PATH
      )
      VALUES (
        @ID,
        @MODULO_FK_ID,
        @TITULO,
        @CRIADO_POR,
        ${columnState.hasDescricao ? "@DESCRICAO," : ""}
        ${columnState.hasProcedimentoId ? "@PROCEDIMENTO_ID," : ""}
        ${columnState.hasNormaId ? "@NORMA_ID," : ""}
        @ATUALIZADO_EM,
        @PATH
      )
    `,
  )

  return getTrilhaById(input.id)
}

export type TrilhaUpdateInput = {
  moduloId?: string | null
  titulo?: string | null
  criadoPor?: string | null
  descricao?: string | null
  procedimentoId?: string | null
  normaId?: string | null
  atualizadoEm?: Date | null
  path?: string | null
}

export async function updateTrilha(id: string, input: TrilhaUpdateInput) {
  const columnState = await getTrilhaColumnState()
  const pool = await getPool()
  const request = pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("MODULO_FK_ID", sql.UniqueIdentifier, input.moduloId ?? null)
    .input("TITULO", sql.NVarChar(255), input.titulo ?? null)
    .input("CRIADO_POR", sql.NVarChar(255), input.criadoPor ?? null)
    .input("ATUALIZADO_EM", sql.DateTime2, input.atualizadoEm ?? null)
    .input("PATH", sql.NVarChar(500), input.path ?? null)

  if (columnState.hasDescricao) {
    request.input("HAS_DESCRICAO", sql.Bit, input.descricao !== undefined)
    request.input("DESCRICAO", sql.NVarChar(sql.MAX), input.descricao ?? null)
  }

  if (columnState.hasProcedimentoId) {
    request.input("HAS_PROCEDIMENTO_ID", sql.Bit, input.procedimentoId !== undefined)
    request.input("PROCEDIMENTO_ID", sql.UniqueIdentifier, input.procedimentoId ?? null)
  }

  if (columnState.hasNormaId) {
    request.input("HAS_NORMA_ID", sql.Bit, input.normaId !== undefined)
    request.input("NORMA_ID", sql.UniqueIdentifier, input.normaId ?? null)
  }

  await request.query(
    `
      UPDATE dbo.TTRILHAS
      SET
        MODULO_FK_ID = COALESCE(@MODULO_FK_ID, MODULO_FK_ID),
        TITULO = COALESCE(@TITULO, TITULO),
        CRIADO_POR = COALESCE(@CRIADO_POR, CRIADO_POR),
        ${columnState.hasDescricao ? "DESCRICAO = CASE WHEN @HAS_DESCRICAO = 1 THEN @DESCRICAO ELSE DESCRICAO END," : ""}
        ${columnState.hasProcedimentoId ? "PROCEDIMENTO_ID = CASE WHEN @HAS_PROCEDIMENTO_ID = 1 THEN @PROCEDIMENTO_ID ELSE PROCEDIMENTO_ID END," : ""}
        ${columnState.hasNormaId ? "NORMA_ID = CASE WHEN @HAS_NORMA_ID = 1 THEN @NORMA_ID ELSE NORMA_ID END," : ""}
        ATUALIZADO_EM = COALESCE(@ATUALIZADO_EM, ATUALIZADO_EM),
        PATH = COALESCE(@PATH, PATH)
      WHERE ID = @ID
    `,
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
