import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"
import { OBJECTIVE_PLACEHOLDER_PATH } from "./provaModel"

export type ProvaAttemptStatus = "aprovado" | "reprovado"

export type ProvaAttemptInput = {
  cpf: string
  provaId: string
  provaVersao: number
  trilhaId: string
  nota: number
  status: ProvaAttemptStatus
  acertos: number
  totalQuestoes: number
  respostasJson?: string | null
  realizadoEm?: Date | null
}

export type ProvaAttemptRecord = {
  ID: string
  USUARIO_CPF: string
  PROVA_ID: string
  PROVA_VERSAO: number
  TRILHA_ID: string
  NOTA: number
  STATUS: ProvaAttemptStatus
  ACERTOS: number
  TOTAL_QUESTOES: number
  RESPOSTAS_JSON: string | null
  DT_REALIZACAO: Date
}

export type ProvaAttemptReportRecord = ProvaAttemptRecord & {
  USUARIO_NOME: string | null
  USUARIO_FUNCAO: string | null
  MODULO_ID: string | null
  MODULO_NOME: string | null
  TRILHA_TITULO: string | null
  PROVA_TITULO: string | null
}

export type ProvaAttemptReportFilter = {
  status?: ProvaAttemptStatus
  dateFrom?: Date
  dateTo?: Date
  trilhaId?: string
}

export type TrilhaTrainedCollaboratorRecord = {
  USUARIO_CPF: string
  USUARIO_NOME: string | null
  USUARIO_FUNCAO: string | null
  OBRA_NOME?: string | null
  SETOR_OBRA?: string | null
  DT_FINALIZACAO: Date
  NOTA: number | null
}

export type TrilhaTrainingStatusRow = {
  USUARIO_CPF: string
  USUARIO_NOME: string | null
  USUARIO_FUNCAO: string | null
  OBRA_NOME: string | null
  SETOR_OBRA: string | null
  DT_ATRIBUICAO: Date | null
  DT_FINALIZACAO: Date | null
  NOTA: number | null
  EH_VERSAO_ANTERIOR: boolean
  ARQUIVADO_EM: Date | null
  STATUS: "Concluido" | "Pendente"
  TIPO_VERSAO: "Atual" | "Versao Anterior"
}

export type TrilhaTrainingStatusSummary = {
  TRILHA_ID: string
  TRILHA_TITULO: string
  MODULO_ID: string
  MODULO_NOME: string
  PROVA_ID: string | null
  PROVA_TITULO: string | null
  PROVA_VERSAO_ATUAL: number | null
}

export type TrilhaTrainingStatusReport = {
  trilha: TrilhaTrainingStatusSummary
  currentRows: TrilhaTrainingStatusRow[]
  previousRows: TrilhaTrainingStatusRow[]
  pendingRows: TrilhaTrainingStatusRow[]
}

const LOCATION_APPLY_CLAUSE = `
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
`

export async function createProvaAttempt(input: ProvaAttemptInput) {
  const pool = await getPool()
  const id = randomUUID()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("USUARIO_CPF", sql.VarChar(100), input.cpf)
    .input("PROVA_ID", sql.UniqueIdentifier, input.provaId)
    .input("PROVA_VERSAO", sql.Int, input.provaVersao)
    .input("TRILHA_ID", sql.UniqueIdentifier, input.trilhaId)
    .input("NOTA", sql.Decimal(5, 2), input.nota)
    .input("STATUS", sql.VarChar(20), input.status)
    .input("ACERTOS", sql.Int, input.acertos)
    .input("TOTAL_QUESTOES", sql.Int, input.totalQuestoes)
    .input("RESPOSTAS_JSON", sql.NVarChar(sql.MAX), input.respostasJson ?? null)
    .input("DT_REALIZACAO", sql.DateTime2, input.realizadoEm ?? new Date())
    .query(`
      INSERT INTO dbo.TUSUARIO_PROVA_TENTATIVAS (
        ID,
        USUARIO_CPF,
        PROVA_ID,
        PROVA_VERSAO,
        TRILHA_ID,
        NOTA,
        STATUS,
        ACERTOS,
        TOTAL_QUESTOES,
        RESPOSTAS_JSON,
        DT_REALIZACAO
      )
      VALUES (
        @ID,
        @USUARIO_CPF,
        @PROVA_ID,
        @PROVA_VERSAO,
        @TRILHA_ID,
        @NOTA,
        @STATUS,
        @ACERTOS,
        @TOTAL_QUESTOES,
        @RESPOSTAS_JSON,
        @DT_REALIZACAO
      )
    `)

  return id
}

export async function getLatestProvaAttemptByTrilha(cpf: string, trilhaId: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), cpf)
    .input("TRILHA_ID", sql.UniqueIdentifier, trilhaId)
    .query(`
      SELECT TOP 1
        ID,
        USUARIO_CPF,
        PROVA_ID,
        PROVA_VERSAO,
        TRILHA_ID,
        NOTA,
        STATUS,
        ACERTOS,
        TOTAL_QUESTOES,
        RESPOSTAS_JSON,
        DT_REALIZACAO
      FROM dbo.TUSUARIO_PROVA_TENTATIVAS
      WHERE USUARIO_CPF = @USUARIO_CPF
        AND TRILHA_ID = @TRILHA_ID
      ORDER BY DT_REALIZACAO DESC
    `)

  return result.recordset[0] as ProvaAttemptRecord | undefined
}

export async function listProvaAttemptsReport(filters?: ProvaAttemptReportFilter) {
  const pool = await getPool()
  const request = pool.request()
  const conditions: string[] = []

  if (filters?.trilhaId) {
    request.input("TRILHA_ID", sql.UniqueIdentifier, filters.trilhaId)
    conditions.push("a.TRILHA_ID = @TRILHA_ID")
  }

  if (filters?.status) {
    request.input("STATUS", sql.VarChar(20), filters.status)
    conditions.push("a.STATUS = @STATUS")
  }

  if (filters?.dateFrom) {
    request.input("DATE_FROM", sql.DateTime2, filters.dateFrom)
    conditions.push("a.DT_REALIZACAO >= @DATE_FROM")
  }

  if (filters?.dateTo) {
    request.input("DATE_TO", sql.DateTime2, filters.dateTo)
    conditions.push("a.DT_REALIZACAO <= @DATE_TO")
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  const result = await request.query(`
      SELECT
        a.ID,
        a.USUARIO_CPF,
        a.PROVA_ID,
        a.PROVA_VERSAO,
        a.TRILHA_ID,
        a.NOTA,
        a.STATUS,
        a.ACERTOS,
        a.TOTAL_QUESTOES,
        a.RESPOSTAS_JSON,
        a.DT_REALIZACAO,
        u.NOME AS USUARIO_NOME,
        u.CARGO AS USUARIO_FUNCAO,
        m.ID AS MODULO_ID,
        m.NOME AS MODULO_NOME,
        tr.TITULO AS TRILHA_TITULO,
        p.TITULO AS PROVA_TITULO
      FROM dbo.TUSUARIO_PROVA_TENTATIVAS a
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = a.USUARIO_CPF
      LEFT JOIN dbo.TTRILHAS tr ON tr.ID = a.TRILHA_ID
      LEFT JOIN dbo.TMODULOS m ON m.ID = tr.MODULO_FK_ID
      LEFT JOIN dbo.TPROVAS p ON p.ID = a.PROVA_ID
      ${where}
      ORDER BY a.DT_REALIZACAO DESC
    `)

  return result.recordset as ProvaAttemptReportRecord[]
}

export async function listTrainedCollaboratorsByTrilha(trilhaId: string) {
  try {
    const report = await getTrilhaTrainingStatusReport(trilhaId)

    return report?.currentRows.map((row) => ({
      USUARIO_CPF: row.USUARIO_CPF,
      USUARIO_NOME: row.USUARIO_NOME,
      USUARIO_FUNCAO: row.USUARIO_FUNCAO,
      OBRA_NOME: row.OBRA_NOME,
      SETOR_OBRA: row.SETOR_OBRA,
      DT_FINALIZACAO: row.DT_FINALIZACAO ?? row.DT_ATRIBUICAO ?? new Date(),
      NOTA: row.NOTA,
    })) ?? []
  } catch (error) {
    console.warn(
      `[treinamento] fallback legado aplicado para trained-collaborators da trilha ${trilhaId}`,
      error,
    )
    return listTrainedCollaboratorsByTrilhaLegacy(trilhaId)
  }
}

async function listTrainedCollaboratorsByTrilhaLegacy(trilhaId: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("TRILHA_ID", sql.UniqueIdentifier, trilhaId)
    .query(`
      WITH PROVA_COMPLETIONS AS (
        SELECT
          ut.USUARIO_CPF,
          ut.DT_CONCLUSAO,
          prova_match.ID AS PROVA_ID,
          prova_match.VERSAO AS PROVA_VERSAO,
          ROW_NUMBER() OVER (
            PARTITION BY ut.USUARIO_CPF
            ORDER BY ut.DT_CONCLUSAO DESC, ISNULL(prova_match.VERSAO, 0) DESC, ut.MATERIAL_ID
          ) AS RN
        FROM dbo.TUSUARIO_TREINAMENTOS ut
        OUTER APPLY (
          SELECT TOP 1
            p.ID,
            p.VERSAO
          FROM dbo.TPROVAS p
          WHERE p.ID = ut.MATERIAL_ID
            AND p.TRILHA_FK_ID = @TRILHA_ID
            AND (
              ut.MATERIAL_VERSAO IS NULL
              OR p.VERSAO = ut.MATERIAL_VERSAO
            )
          ORDER BY
            CASE WHEN ut.MATERIAL_VERSAO IS NULL THEN p.VERSAO ELSE 0 END DESC,
            p.VERSAO DESC
        ) prova_match
        WHERE ut.TIPO = 'prova'
          AND ut.ARQUIVADO_EM IS NULL
          AND prova_match.ID IS NOT NULL
      )
      SELECT
        pc.USUARIO_CPF,
        u.NOME AS USUARIO_NOME,
        u.CARGO AS USUARIO_FUNCAO,
        loc.OBRA_NOME,
        loc.SETOR_OBRA,
        pc.DT_CONCLUSAO AS DT_FINALIZACAO,
        COALESCE(exact_attempt.NOTA, latest_attempt.NOTA, 0) AS NOTA
      FROM PROVA_COMPLETIONS pc
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = pc.USUARIO_CPF
      ${LOCATION_APPLY_CLAUSE}
      OUTER APPLY (
        SELECT TOP 1
          a.NOTA
        FROM dbo.TUSUARIO_PROVA_TENTATIVAS a
        WHERE a.USUARIO_CPF = pc.USUARIO_CPF
          AND a.PROVA_ID = pc.PROVA_ID
          AND (
            pc.PROVA_VERSAO IS NULL
            OR a.PROVA_VERSAO = pc.PROVA_VERSAO
          )
        ORDER BY a.DT_REALIZACAO DESC
      ) exact_attempt
      OUTER APPLY (
        SELECT TOP 1
          a.NOTA
        FROM dbo.TUSUARIO_PROVA_TENTATIVAS a
        WHERE a.USUARIO_CPF = pc.USUARIO_CPF
          AND a.TRILHA_ID = @TRILHA_ID
        ORDER BY a.DT_REALIZACAO DESC
      ) latest_attempt
      WHERE pc.RN = 1
      ORDER BY pc.DT_CONCLUSAO DESC
    `)

  return result.recordset as TrilhaTrainedCollaboratorRecord[]
}

export async function getTrilhaTrainingStatusReport(
  trilhaId: string,
): Promise<TrilhaTrainingStatusReport | null> {
  const pool = await getPool()
  const summaryResult = await pool
    .request()
    .input("TRILHA_ID", sql.UniqueIdentifier, trilhaId)
    .input("OBJECTIVE_PROVA_PATH", sql.NVarChar(1000), OBJECTIVE_PLACEHOLDER_PATH)
    .query(`
      SELECT TOP 1
        t.ID AS TRILHA_ID,
        t.TITULO AS TRILHA_TITULO,
        m.ID AS MODULO_ID,
        m.NOME AS MODULO_NOME,
        p.ID AS PROVA_ID,
        p.TITULO AS PROVA_TITULO,
        p.VERSAO AS PROVA_VERSAO_ATUAL
      FROM dbo.TTRILHAS t
      JOIN dbo.TMODULOS m
        ON m.ID = t.MODULO_FK_ID
      LEFT JOIN dbo.TPROVAS p
        ON p.TRILHA_FK_ID = t.ID
       AND p.PROVA_PATH = @OBJECTIVE_PROVA_PATH
      WHERE t.ID = @TRILHA_ID
    `)

  const trilha = summaryResult.recordset[0] as TrilhaTrainingStatusSummary | undefined
  if (!trilha) {
    return null
  }

  const result = await pool
    .request()
    .input("TRILHA_ID", sql.UniqueIdentifier, trilhaId)
    .input("OBJECTIVE_PROVA_PATH", sql.NVarChar(1000), OBJECTIVE_PLACEHOLDER_PATH)
    .query(`
      WITH CURRENT_COMPLETIONS_BASE AS (
        SELECT
          ut.USUARIO_CPF,
          u.NOME AS USUARIO_NOME,
          u.CARGO AS USUARIO_FUNCAO,
          loc.OBRA_NOME,
          loc.SETOR_OBRA,
          CAST(NULL AS DATETIME2) AS DT_ATRIBUICAO,
          ut.DT_CONCLUSAO AS DT_FINALIZACAO,
          COALESCE(exact_attempt.NOTA, latest_attempt.NOTA, 0) AS NOTA,
          CAST(0 AS BIT) AS EH_VERSAO_ANTERIOR,
          CAST(NULL AS DATETIME2) AS ARQUIVADO_EM,
          ROW_NUMBER() OVER (
            PARTITION BY ut.USUARIO_CPF
            ORDER BY ut.DT_CONCLUSAO DESC, ISNULL(ut.MATERIAL_VERSAO, 0) DESC, ut.MATERIAL_ID
          ) AS RN
        FROM dbo.TUSUARIO_TREINAMENTOS ut
        JOIN dbo.TPROVAS pr
          ON pr.ID = ut.MATERIAL_ID
         AND pr.TRILHA_FK_ID = @TRILHA_ID
         AND pr.PROVA_PATH = @OBJECTIVE_PROVA_PATH
        LEFT JOIN dbo.TUSUARIOS u
          ON u.CPF = ut.USUARIO_CPF
        ${LOCATION_APPLY_CLAUSE}
        OUTER APPLY (
          SELECT TOP 1
            a.NOTA
          FROM dbo.TUSUARIO_PROVA_TENTATIVAS a
          WHERE a.USUARIO_CPF = ut.USUARIO_CPF
            AND a.PROVA_ID = ut.MATERIAL_ID
            AND (
              ut.MATERIAL_VERSAO IS NULL
              OR a.PROVA_VERSAO = ut.MATERIAL_VERSAO
            )
          ORDER BY
            a.DT_REALIZACAO DESC
        ) exact_attempt
        OUTER APPLY (
          SELECT TOP 1
            a.NOTA
          FROM dbo.TUSUARIO_PROVA_TENTATIVAS a
          WHERE a.USUARIO_CPF = ut.USUARIO_CPF
            AND a.TRILHA_ID = @TRILHA_ID
          ORDER BY a.DT_REALIZACAO DESC
        ) latest_attempt
        WHERE ut.TIPO = 'prova'
          AND ut.ARQUIVADO_EM IS NULL
          AND ISNULL(u.ATIVO, 1) = 1
      ),
      CURRENT_COMPLETIONS AS (
        SELECT
          USUARIO_CPF,
          USUARIO_NOME,
          USUARIO_FUNCAO,
          OBRA_NOME,
          SETOR_OBRA,
          DT_ATRIBUICAO,
          DT_FINALIZACAO,
          NOTA,
          EH_VERSAO_ANTERIOR,
          ARQUIVADO_EM
        FROM CURRENT_COMPLETIONS_BASE
        WHERE RN = 1
      ),
      TRILHA_COMPLETIONS_RAW AS (
        SELECT
          ut.USUARIO_CPF,
          u.NOME AS USUARIO_NOME,
          u.CARGO AS USUARIO_FUNCAO,
          loc.OBRA_NOME,
          loc.SETOR_OBRA,
          CAST(NULL AS DATETIME2) AS DT_ATRIBUICAO,
          ut.DT_CONCLUSAO AS DT_FINALIZACAO,
          CAST(0 AS DECIMAL(5, 2)) AS NOTA,
          CAST(0 AS BIT) AS EH_VERSAO_ANTERIOR,
          CAST(NULL AS DATETIME2) AS ARQUIVADO_EM
        FROM dbo.TUSUARIO_TREINAMENTOS ut
        LEFT JOIN dbo.TUSUARIOS u ON u.CPF = ut.USUARIO_CPF
        ${LOCATION_APPLY_CLAUSE}
        WHERE ut.TIPO = 'trilha'
          AND ut.MATERIAL_ID = @TRILHA_ID
          AND ut.ARQUIVADO_EM IS NULL
          AND ISNULL(u.ATIVO, 1) = 1
          AND NOT EXISTS (
            SELECT 1 FROM CURRENT_COMPLETIONS cc
            WHERE cc.USUARIO_CPF = ut.USUARIO_CPF
          )
        UNION ALL
        SELECT
          ut.USUARIO_CPF,
          u.NOME AS USUARIO_NOME,
          u.CARGO AS USUARIO_FUNCAO,
          loc.OBRA_NOME,
          loc.SETOR_OBRA,
          CAST(NULL AS DATETIME2) AS DT_ATRIBUICAO,
          ut.DT_CONCLUSAO AS DT_FINALIZACAO,
          CAST(0 AS DECIMAL(5, 2)) AS NOTA,
          CAST(0 AS BIT) AS EH_VERSAO_ANTERIOR,
          CAST(NULL AS DATETIME2) AS ARQUIVADO_EM
        FROM dbo.TUSUARIO_TREINAMENTOS ut
        LEFT JOIN dbo.TUSUARIOS u ON u.CPF = ut.USUARIO_CPF
        ${LOCATION_APPLY_CLAUSE}
        WHERE ut.TIPO = 'prova'
          AND ut.ORIGEM LIKE 'trilha-%'
          AND ut.MATERIAL_ID = @TRILHA_ID
          AND ut.ARQUIVADO_EM IS NULL
          AND ISNULL(u.ATIVO, 1) = 1
          AND NOT EXISTS (
            SELECT 1 FROM CURRENT_COMPLETIONS cc
            WHERE cc.USUARIO_CPF = ut.USUARIO_CPF
          )
      ),
      TRILHA_COMPLETIONS_BASE AS (
        SELECT
          raw.*,
          ROW_NUMBER() OVER (
            PARTITION BY raw.USUARIO_CPF
            ORDER BY raw.DT_FINALIZACAO DESC
          ) AS RN
        FROM TRILHA_COMPLETIONS_RAW raw
      ),
      TRILHA_COMPLETIONS AS (
        SELECT
          USUARIO_CPF,
          USUARIO_NOME,
          USUARIO_FUNCAO,
          OBRA_NOME,
          SETOR_OBRA,
          DT_ATRIBUICAO,
          DT_FINALIZACAO,
          NOTA,
          EH_VERSAO_ANTERIOR,
          ARQUIVADO_EM
        FROM TRILHA_COMPLETIONS_BASE
        WHERE RN = 1
      ),
      PREVIOUS_COMPLETIONS AS (
        SELECT
          ut.USUARIO_CPF,
          u.NOME AS USUARIO_NOME,
          u.CARGO AS USUARIO_FUNCAO,
          loc.OBRA_NOME,
          loc.SETOR_OBRA,
          CAST(NULL AS DATETIME2) AS DT_ATRIBUICAO,
          ut.DT_CONCLUSAO AS DT_FINALIZACAO,
          COALESCE(exact_attempt.NOTA, latest_attempt.NOTA, 0) AS NOTA,
          CAST(1 AS BIT) AS EH_VERSAO_ANTERIOR,
          ut.ARQUIVADO_EM
        FROM dbo.TUSUARIO_TREINAMENTOS ut
        JOIN dbo.TPROVAS pr
          ON pr.ID = ut.MATERIAL_ID
         AND pr.TRILHA_FK_ID = @TRILHA_ID
         AND pr.PROVA_PATH = @OBJECTIVE_PROVA_PATH
        LEFT JOIN dbo.TUSUARIOS u
          ON u.CPF = ut.USUARIO_CPF
        ${LOCATION_APPLY_CLAUSE}
        OUTER APPLY (
          SELECT TOP 1
            a.NOTA
          FROM dbo.TUSUARIO_PROVA_TENTATIVAS a
          WHERE a.USUARIO_CPF = ut.USUARIO_CPF
            AND a.PROVA_ID = ut.MATERIAL_ID
            AND (
              ut.MATERIAL_VERSAO IS NULL
              OR a.PROVA_VERSAO = ut.MATERIAL_VERSAO
            )
          ORDER BY a.DT_REALIZACAO DESC
        ) exact_attempt
        OUTER APPLY (
          SELECT TOP 1
            a.NOTA
          FROM dbo.TUSUARIO_PROVA_TENTATIVAS a
          WHERE a.USUARIO_CPF = ut.USUARIO_CPF
            AND a.TRILHA_ID = @TRILHA_ID
          ORDER BY a.DT_REALIZACAO DESC
        ) latest_attempt
        WHERE ut.TIPO = 'prova'
          AND ut.ARQUIVADO_EM IS NOT NULL
          AND ISNULL(u.ATIVO, 1) = 1
      ),
      PENDING_ASSIGNMENTS_BASE AS (
        SELECT
          ut.USUARIO_CPF,
          u.NOME AS USUARIO_NOME,
          u.CARGO AS USUARIO_FUNCAO,
          loc.OBRA_NOME,
          loc.SETOR_OBRA,
          ut.DT_ATRIBUICAO,
          CAST(NULL AS DATETIME2) AS DT_FINALIZACAO,
          CAST(NULL AS DECIMAL(5, 2)) AS NOTA,
          CAST(0 AS BIT) AS EH_VERSAO_ANTERIOR,
          CAST(NULL AS DATETIME2) AS ARQUIVADO_EM,
          ROW_NUMBER() OVER (
            PARTITION BY ut.USUARIO_CPF
            ORDER BY ut.DT_ATRIBUICAO DESC
          ) AS RN
        FROM dbo.TUSUARIO_TRILHAS ut
        LEFT JOIN dbo.TUSUARIOS u
          ON u.CPF = ut.USUARIO_CPF
        ${LOCATION_APPLY_CLAUSE}
        WHERE ut.TRILHA_ID = @TRILHA_ID
          AND ISNULL(u.ATIVO, 1) = 1
          AND NOT EXISTS (
            SELECT 1
            FROM CURRENT_COMPLETIONS cc
            WHERE cc.USUARIO_CPF = ut.USUARIO_CPF
          )
          AND NOT EXISTS (
            SELECT 1
            FROM TRILHA_COMPLETIONS tc
            WHERE tc.USUARIO_CPF = ut.USUARIO_CPF
          )
      ),
      PENDING_ASSIGNMENTS AS (
        SELECT
          USUARIO_CPF,
          USUARIO_NOME,
          USUARIO_FUNCAO,
          OBRA_NOME,
          SETOR_OBRA,
          DT_ATRIBUICAO,
          DT_FINALIZACAO,
          NOTA,
          EH_VERSAO_ANTERIOR,
          ARQUIVADO_EM
        FROM PENDING_ASSIGNMENTS_BASE
        WHERE RN = 1
      ),
      ALL_ROWS AS (
        SELECT
          cc.USUARIO_CPF,
          cc.USUARIO_NOME,
          cc.USUARIO_FUNCAO,
          cc.OBRA_NOME,
          cc.SETOR_OBRA,
          cc.DT_ATRIBUICAO,
          cc.DT_FINALIZACAO,
          cc.NOTA,
          cc.EH_VERSAO_ANTERIOR,
          cc.ARQUIVADO_EM,
          CAST('Concluido' AS NVARCHAR(30)) AS STATUS,
          CAST('Atual' AS NVARCHAR(30)) AS TIPO_VERSAO
        FROM CURRENT_COMPLETIONS cc

        UNION ALL

        SELECT
          pc.USUARIO_CPF,
          pc.USUARIO_NOME,
          pc.USUARIO_FUNCAO,
          pc.OBRA_NOME,
          pc.SETOR_OBRA,
          pc.DT_ATRIBUICAO,
          pc.DT_FINALIZACAO,
          pc.NOTA,
          pc.EH_VERSAO_ANTERIOR,
          pc.ARQUIVADO_EM,
          CAST('Concluido' AS NVARCHAR(30)) AS STATUS,
          CAST('Versao Anterior' AS NVARCHAR(30)) AS TIPO_VERSAO
        FROM PREVIOUS_COMPLETIONS pc

        UNION ALL

        SELECT
          tc.USUARIO_CPF,
          tc.USUARIO_NOME,
          tc.USUARIO_FUNCAO,
          tc.OBRA_NOME,
          tc.SETOR_OBRA,
          tc.DT_ATRIBUICAO,
          tc.DT_FINALIZACAO,
          tc.NOTA,
          tc.EH_VERSAO_ANTERIOR,
          tc.ARQUIVADO_EM,
          CAST('Concluido' AS NVARCHAR(30)) AS STATUS,
          CAST('Atual' AS NVARCHAR(30)) AS TIPO_VERSAO
        FROM TRILHA_COMPLETIONS tc

        UNION ALL

        SELECT
          pa.USUARIO_CPF,
          pa.USUARIO_NOME,
          pa.USUARIO_FUNCAO,
          pa.OBRA_NOME,
          pa.SETOR_OBRA,
          pa.DT_ATRIBUICAO,
          pa.DT_FINALIZACAO,
          pa.NOTA,
          pa.EH_VERSAO_ANTERIOR,
          pa.ARQUIVADO_EM,
          CAST('Pendente' AS NVARCHAR(30)) AS STATUS,
          CAST('Atual' AS NVARCHAR(30)) AS TIPO_VERSAO
        FROM PENDING_ASSIGNMENTS pa
      )
      SELECT
        USUARIO_CPF,
        USUARIO_NOME,
        USUARIO_FUNCAO,
        OBRA_NOME,
        SETOR_OBRA,
        DT_ATRIBUICAO,
        DT_FINALIZACAO,
        NOTA,
        EH_VERSAO_ANTERIOR,
        ARQUIVADO_EM,
        STATUS,
        TIPO_VERSAO
      FROM ALL_ROWS
      ORDER BY
        CASE
          WHEN STATUS = 'Concluido' AND EH_VERSAO_ANTERIOR = 0 THEN 0
          WHEN STATUS = 'Pendente' THEN 1
          ELSE 2
        END,
        ISNULL(DT_FINALIZACAO, DT_ATRIBUICAO) DESC,
        ARQUIVADO_EM DESC
    `)

  const rows = result.recordset as TrilhaTrainingStatusRow[]

  return {
    trilha,
    currentRows: rows.filter((row) => row.STATUS === "Concluido" && row.EH_VERSAO_ANTERIOR !== true),
    previousRows: rows.filter((row) => row.EH_VERSAO_ANTERIOR === true),
    pendingRows: rows.filter((row) => row.STATUS === "Pendente"),
  }
}
