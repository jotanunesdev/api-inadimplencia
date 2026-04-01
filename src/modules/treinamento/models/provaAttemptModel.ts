import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

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
  DT_FINALIZACAO: Date
  NOTA: number | null
}

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
        pc.DT_CONCLUSAO AS DT_FINALIZACAO,
        COALESCE(exact_attempt.NOTA, latest_attempt.NOTA, 0) AS NOTA
      FROM PROVA_COMPLETIONS pc
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = pc.USUARIO_CPF
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
