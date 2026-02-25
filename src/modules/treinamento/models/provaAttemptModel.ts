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
