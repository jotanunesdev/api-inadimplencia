import { getPool, sql } from "../config/db"

export type UserTrainingStatusReportRecord = {
  USUARIO_CPF: string
  USUARIO_NOME: string | null
  USUARIO_FUNCAO: string | null
  OBRA_NOME: string | null
  SETOR_OBRA: string | null
  MODULO_ID: string
  MODULO_NOME: string
  TRILHA_ID: string
  TRILHA_TITULO: string
  DT_ATRIBUICAO: Date
  TOTAL_VIDEOS: number
  TOTAL_CONCLUIDOS: number
  TOTAL_PENDENTES: number
  STATUS: "Pendente" | "Concluido" | "Sem Conteudo"
  ULTIMA_CONCLUSAO: Date | null
}

export type ProcedimentoVersionChangeRecord = {
  ID: string
  NOME: string
  VERSAO: number
  ALTERADO_EM: Date
  PATH_PDF: string
  OBSERVACOES: string | null
}

export type ObraTrainingOverviewRecord = {
  OBRA: string
  TREINADOS: number
  PENDENTES: number
}

const TRAINING_STATUS_CTE = `
  WITH V_LATEST AS (
    SELECT
      v.ID,
      v.TRILHA_FK_ID,
      v.VERSAO,
      ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
    FROM dbo.TVIDEOS v
  ),
  V_ATUAL AS (
    SELECT ID, TRILHA_FK_ID, VERSAO
    FROM V_LATEST
    WHERE RN = 1
  ),
  TRILHA_TOTAL AS (
    SELECT
      v.TRILHA_FK_ID AS TRILHA_ID,
      COUNT(*) AS TOTAL_VIDEOS
    FROM V_ATUAL v
    GROUP BY v.TRILHA_FK_ID
  ),
  USER_DONE AS (
    SELECT
      ut.USUARIO_CPF,
      v.TRILHA_FK_ID AS TRILHA_ID,
      COUNT(DISTINCT ut.MATERIAL_ID) AS TOTAL_CONCLUIDOS,
      MAX(ut.DT_CONCLUSAO) AS ULTIMA_CONCLUSAO
    FROM dbo.TUSUARIO_TREINAMENTOS ut
    JOIN V_ATUAL v
      ON v.ID = ut.MATERIAL_ID
     AND v.VERSAO = ut.MATERIAL_VERSAO
    WHERE ut.TIPO = 'video'
      AND ut.ARQUIVADO_EM IS NULL
    GROUP BY ut.USUARIO_CPF, v.TRILHA_FK_ID
  ),
  STATUS_BASE AS (
    SELECT
      ut.USUARIO_CPF,
      u.NOME AS USUARIO_NOME,
      u.CARGO AS USUARIO_FUNCAO,
      m.ID AS MODULO_ID,
      m.NOME AS MODULO_NOME,
      t.ID AS TRILHA_ID,
      t.TITULO AS TRILHA_TITULO,
      ut.DT_ATRIBUICAO,
      ISNULL(tt.TOTAL_VIDEOS, 0) AS TOTAL_VIDEOS,
      ISNULL(ud.TOTAL_CONCLUIDOS, 0) AS TOTAL_CONCLUIDOS,
      CASE
        WHEN ISNULL(tt.TOTAL_VIDEOS, 0) - ISNULL(ud.TOTAL_CONCLUIDOS, 0) > 0
          THEN ISNULL(tt.TOTAL_VIDEOS, 0) - ISNULL(ud.TOTAL_CONCLUIDOS, 0)
        ELSE 0
      END AS TOTAL_PENDENTES,
      ud.ULTIMA_CONCLUSAO,
      loc.OBRA_NOME,
      loc.SETOR_OBRA
    FROM dbo.TUSUARIO_TRILHAS ut
    JOIN dbo.TTRILHAS t ON t.ID = ut.TRILHA_ID
    JOIN dbo.TMODULOS m ON m.ID = t.MODULO_FK_ID
    LEFT JOIN dbo.TUSUARIOS u ON u.CPF = ut.USUARIO_CPF
    LEFT JOIN TRILHA_TOTAL tt ON tt.TRILHA_ID = t.ID
    LEFT JOIN USER_DONE ud
      ON ud.USUARIO_CPF = ut.USUARIO_CPF
     AND ud.TRILHA_ID = t.ID
    OUTER APPLY (
      SELECT
        COALESCE(
          JSON_VALUE(u.READVIEW_JSON, '$.DESCRICAOSECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.NOME_SECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.NOMEDEPARTAMENTO'),
          u.SETOR
        ) AS LOCAL_DESCRICAO
    ) rawloc
    OUTER APPLY (
      SELECT
        CASE
          WHEN rawloc.LOCAL_DESCRICAO IS NULL OR LTRIM(RTRIM(rawloc.LOCAL_DESCRICAO)) = '' THEN NULL
          WHEN CHARINDEX(' - ', rawloc.LOCAL_DESCRICAO) > 0
            THEN LTRIM(RTRIM(LEFT(rawloc.LOCAL_DESCRICAO, CHARINDEX(' - ', rawloc.LOCAL_DESCRICAO) - 1)))
          ELSE LTRIM(RTRIM(rawloc.LOCAL_DESCRICAO))
        END AS OBRA_NOME,
        CASE
          WHEN rawloc.LOCAL_DESCRICAO IS NULL OR LTRIM(RTRIM(rawloc.LOCAL_DESCRICAO)) = '' THEN NULL
          WHEN CHARINDEX(' - ', rawloc.LOCAL_DESCRICAO) > 0
            THEN LTRIM(
              RTRIM(
                SUBSTRING(
                  rawloc.LOCAL_DESCRICAO,
                  CHARINDEX(' - ', rawloc.LOCAL_DESCRICAO) + 3,
                  LEN(rawloc.LOCAL_DESCRICAO)
                )
              )
            )
          ELSE NULL
        END AS SETOR_OBRA
    ) loc
    WHERE ISNULL(u.ATIVO, 1) = 1
  )
`

export async function listUserTrainingStatusReport(cpf: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), cpf)
    .query(`
      ${TRAINING_STATUS_CTE}
      SELECT
        sb.USUARIO_CPF,
        sb.USUARIO_NOME,
        sb.USUARIO_FUNCAO,
        sb.OBRA_NOME,
        sb.SETOR_OBRA,
        sb.MODULO_ID,
        sb.MODULO_NOME,
        sb.TRILHA_ID,
        sb.TRILHA_TITULO,
        sb.DT_ATRIBUICAO,
        sb.TOTAL_VIDEOS,
        sb.TOTAL_CONCLUIDOS,
        sb.TOTAL_PENDENTES,
        CAST(
          CASE
            WHEN sb.TOTAL_VIDEOS = 0 THEN 'Sem Conteudo'
            WHEN sb.TOTAL_PENDENTES = 0 THEN 'Concluido'
            ELSE 'Pendente'
          END AS NVARCHAR(30)
        ) AS STATUS,
        sb.ULTIMA_CONCLUSAO
      FROM STATUS_BASE sb
      WHERE sb.USUARIO_CPF = @USUARIO_CPF
      ORDER BY sb.MODULO_NOME, sb.TRILHA_TITULO
    `)

  return result.recordset as UserTrainingStatusReportRecord[]
}

export async function listObraTrainingStatusReport(params?: {
  obraNome?: string | null
  apenasPendentes?: boolean
  apenasConcluidos?: boolean
}) {
  const pool = await getPool()
  const request = pool.request()

  if (params?.obraNome && params.obraNome.trim()) {
    request.input("OBRA_NOME", sql.NVarChar(255), params.obraNome.trim())
  } else {
    request.input("OBRA_NOME", sql.NVarChar(255), null)
  }

  const onlyPending = params?.apenasPendentes === true
  const onlyCompleted = params?.apenasConcluidos === true
  const statusFilters: string[] = ["sb.TOTAL_VIDEOS > 0"]

  if (onlyPending) {
    statusFilters.push("sb.TOTAL_PENDENTES > 0")
  }

  if (onlyCompleted) {
    statusFilters.push("sb.TOTAL_PENDENTES = 0")
  }

  const result = await request.query(`
      ${TRAINING_STATUS_CTE}
      SELECT
        sb.USUARIO_CPF,
        sb.USUARIO_NOME,
        sb.USUARIO_FUNCAO,
        sb.OBRA_NOME,
        sb.SETOR_OBRA,
        sb.MODULO_ID,
        sb.MODULO_NOME,
        sb.TRILHA_ID,
        sb.TRILHA_TITULO,
        sb.DT_ATRIBUICAO,
        sb.TOTAL_VIDEOS,
        sb.TOTAL_CONCLUIDOS,
        sb.TOTAL_PENDENTES,
        CAST(
          CASE
            WHEN sb.TOTAL_VIDEOS = 0 THEN 'Sem Conteudo'
            WHEN sb.TOTAL_PENDENTES = 0 THEN 'Concluido'
            ELSE 'Pendente'
          END AS NVARCHAR(30)
        ) AS STATUS,
        sb.ULTIMA_CONCLUSAO
      FROM STATUS_BASE sb
      WHERE (@OBRA_NOME IS NULL OR sb.OBRA_NOME COLLATE Latin1_General_CI_AI = @OBRA_NOME COLLATE Latin1_General_CI_AI)
        AND ${statusFilters.join(" AND ")}
      ORDER BY sb.OBRA_NOME, sb.SETOR_OBRA, sb.USUARIO_NOME, sb.MODULO_NOME, sb.TRILHA_TITULO
    `)

  return result.recordset as UserTrainingStatusReportRecord[]
}

export async function listProcedimentoVersionChangesReport(params?: {
  inicio?: Date | null
  fim?: Date | null
}) {
  const pool = await getPool()
  const request = pool.request()
  request.input("DATA_INICIO", sql.DateTime2, params?.inicio ?? null)
  request.input("DATA_FIM", sql.DateTime2, params?.fim ?? null)

  const changedResult = await request.query(`
      SELECT
        p.ID,
        p.NOME,
        p.VERSAO,
        p.ALTERADO_EM,
        p.PATH_PDF,
        p.OBSERVACOES
      FROM dbo.TPROCEDIMENTOS p
      WHERE (@DATA_INICIO IS NULL OR p.ALTERADO_EM >= @DATA_INICIO)
        AND (
          @DATA_FIM IS NULL
          OR p.ALTERADO_EM < DATEADD(DAY, 1, @DATA_FIM)
        )
      ORDER BY p.ALTERADO_EM DESC, p.NOME, p.VERSAO DESC
    `)

  const activeResult = await pool.request().query(`
      WITH PROC_LATEST AS (
        SELECT
          p.ID,
          p.NOME,
          p.VERSAO,
          p.ALTERADO_EM,
          p.PATH_PDF,
          p.OBSERVACOES,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPROCEDIMENTOS p
      )
      SELECT
        ID,
        NOME,
        VERSAO,
        ALTERADO_EM,
        PATH_PDF,
        OBSERVACOES
      FROM PROC_LATEST
      WHERE RN = 1
      ORDER BY NOME
    `)

  return {
    alteracoes: changedResult.recordset as ProcedimentoVersionChangeRecord[],
    ativos: activeResult.recordset as ProcedimentoVersionChangeRecord[],
  }
}

export async function listObraTrainingOverviewReport() {
  const pool = await getPool()
  const result = await pool.request().query(`
      ${TRAINING_STATUS_CTE}
      SELECT
        ISNULL(NULLIF(LTRIM(RTRIM(sb.OBRA_NOME)), ''), 'Nao informado') AS OBRA,
        SUM(CASE WHEN sb.TOTAL_VIDEOS > 0 AND sb.TOTAL_PENDENTES = 0 THEN 1 ELSE 0 END) AS TREINADOS,
        SUM(CASE WHEN sb.TOTAL_VIDEOS > 0 AND sb.TOTAL_PENDENTES > 0 THEN 1 ELSE 0 END) AS PENDENTES
      FROM STATUS_BASE sb
      GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(sb.OBRA_NOME)), ''), 'Nao informado')
      HAVING SUM(CASE WHEN sb.TOTAL_VIDEOS > 0 THEN 1 ELSE 0 END) > 0
      ORDER BY OBRA
    `)

  return result.recordset as ObraTrainingOverviewRecord[]
}
