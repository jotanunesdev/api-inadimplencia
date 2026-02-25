import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type TurmaRecord = {
  ID: string
  NOME: string
  STATUS: string
  CRIADO_POR: string | null
  CRIADO_EM: Date
  INICIADO_EM: Date | null
  FINALIZADO_EM: Date | null
  DURACAO_TREINAMENTO_MINUTOS?: number | null
  TOTAL_PARTICIPANTES: number
  TOTAL_TREINADOS: number
}

export type TurmaEvidenciaRecord = {
  ID: string
  TURMA_ID: string
  ARQUIVO_PATH: string
  CRIADO_POR: string | null
  CRIADO_EM: Date
  ORDEM: number
}

export type CollectiveTrainingHoursMonthlyRow = {
  ANO: number
  MES: number
  TOTAL_HORAS: number
}

async function ensureTurmaEvidenciaSchema() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.TTURMAS_TREINAMENTO', 'DURACAO_TREINAMENTO_MINUTOS') AS DURACAO_COL,
      OBJECT_ID('dbo.TTURMA_EVIDENCIAS') AS EVID_TABLE_ID
  `)

  const row = result.recordset[0] as
    | { DURACAO_COL?: number | null; EVID_TABLE_ID?: number | null }
    | undefined
  if (!row?.DURACAO_COL || !row?.EVID_TABLE_ID) {
    const error = new Error("Schema de evidencias da turma ausente")
    ;(error as Error & { code?: string }).code = "TURMA_EVIDENCIA_SCHEMA_MISSING"
    throw error
  }
}

export type TurmaParticipantRecord = {
  TURMA_ID: string
  USUARIO_CPF: string
  USUARIO_NOME: string | null
  USUARIO_FUNCAO: string | null
  USUARIO_SETOR: string | null
  INSCRITO_EM: Date
  VIDEOS_CONCLUIDOS: number
  ULTIMA_CONCLUSAO: Date | null
}

export async function createTurma(input: {
  nome: string
  criadoPor?: string | null
  iniciadoEm?: Date | null
  participantesCpf: string[]
}) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  const turmaId = randomUUID()
  const startedAt = input.iniciadoEm ?? new Date()
  const status = "iniciada"

  try {
    await new sql.Request(transaction)
      .input("ID", sql.UniqueIdentifier, turmaId)
      .input("NOME", sql.NVarChar(200), input.nome)
      .input("STATUS", sql.VarChar(30), status)
      .input("CRIADO_POR", sql.VarChar(100), input.criadoPor ?? null)
      .input("INICIADO_EM", sql.DateTime2, startedAt)
      .query(`
        INSERT INTO dbo.TTURMAS_TREINAMENTO (
          ID,
          NOME,
          STATUS,
          CRIADO_POR,
          INICIADO_EM
        )
        VALUES (
          @ID,
          @NOME,
          @STATUS,
          @CRIADO_POR,
          @INICIADO_EM
        )
      `)

    for (const cpf of input.participantesCpf) {
      await new sql.Request(transaction)
        .input("ID", sql.UniqueIdentifier, randomUUID())
        .input("TURMA_ID", sql.UniqueIdentifier, turmaId)
        .input("USUARIO_CPF", sql.VarChar(100), cpf)
        .query(`
          INSERT INTO dbo.TTURMA_COLABORADORES (
            ID,
            TURMA_ID,
            USUARIO_CPF
          )
          SELECT
            @ID,
            @TURMA_ID,
            @USUARIO_CPF
          WHERE NOT EXISTS (
            SELECT 1
            FROM dbo.TTURMA_COLABORADORES
            WHERE TURMA_ID = @TURMA_ID
              AND USUARIO_CPF = @USUARIO_CPF
          )
        `)
    }

    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }

  const turma = await getTurmaById(turmaId)
  return turma
}

export async function getTurmaById(turmaId: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("TURMA_ID", sql.UniqueIdentifier, turmaId)
    .query(`
      SELECT
        t.ID,
        t.NOME,
        t.STATUS,
        t.CRIADO_POR,
        t.CRIADO_EM,
        t.INICIADO_EM,
        t.FINALIZADO_EM,
        t.DURACAO_TREINAMENTO_MINUTOS,
        ISNULL(p.TOTAL_PARTICIPANTES, 0) AS TOTAL_PARTICIPANTES,
        ISNULL(c.TOTAL_TREINADOS, 0) AS TOTAL_TREINADOS
      FROM dbo.TTURMAS_TREINAMENTO t
      OUTER APPLY (
        SELECT COUNT(*) AS TOTAL_PARTICIPANTES
        FROM dbo.TTURMA_COLABORADORES p
        WHERE p.TURMA_ID = t.ID
      ) p
      OUTER APPLY (
        SELECT COUNT(DISTINCT ut.USUARIO_CPF) AS TOTAL_TREINADOS
        FROM dbo.TUSUARIO_TREINAMENTOS ut
        WHERE ut.TURMA_ID = t.ID
          AND ut.TIPO = 'video'
          AND ut.ARQUIVADO_EM IS NULL
      ) c
      WHERE t.ID = @TURMA_ID
    `)

  return result.recordset[0] as TurmaRecord | undefined
}

export async function listTurmas(search?: string) {
  const pool = await getPool()
  const request = pool.request()

  let where = ""
  if (search?.trim()) {
    request.input("SEARCH", sql.NVarChar(250), `%${search.trim()}%`)
    where = `
      WHERE t.NOME LIKE @SEARCH
      OR EXISTS (
        SELECT 1
        FROM dbo.TTURMA_COLABORADORES tc
        LEFT JOIN dbo.TUSUARIOS u ON u.CPF = tc.USUARIO_CPF
        WHERE tc.TURMA_ID = t.ID
          AND (
            tc.USUARIO_CPF LIKE @SEARCH
            OR u.NOME LIKE @SEARCH
          )
      )
    `
  }

  const result = await request.query(`
    SELECT
      t.ID,
      t.NOME,
      t.STATUS,
      t.CRIADO_POR,
      t.CRIADO_EM,
      t.INICIADO_EM,
      t.FINALIZADO_EM,
      t.DURACAO_TREINAMENTO_MINUTOS,
      ISNULL(p.TOTAL_PARTICIPANTES, 0) AS TOTAL_PARTICIPANTES,
      ISNULL(c.TOTAL_TREINADOS, 0) AS TOTAL_TREINADOS
    FROM dbo.TTURMAS_TREINAMENTO t
    OUTER APPLY (
      SELECT COUNT(*) AS TOTAL_PARTICIPANTES
      FROM dbo.TTURMA_COLABORADORES p
      WHERE p.TURMA_ID = t.ID
    ) p
    OUTER APPLY (
      SELECT COUNT(DISTINCT ut.USUARIO_CPF) AS TOTAL_TREINADOS
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      WHERE ut.TURMA_ID = t.ID
        AND ut.TIPO = 'video'
        AND ut.ARQUIVADO_EM IS NULL
    ) c
    ${where}
    ORDER BY t.CRIADO_EM DESC
  `)

  return result.recordset as TurmaRecord[]
}

export async function listTurmaParticipants(turmaId: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("TURMA_ID", sql.UniqueIdentifier, turmaId)
    .query(`
      SELECT
        tc.TURMA_ID,
        tc.USUARIO_CPF,
        u.NOME AS USUARIO_NOME,
        u.CARGO AS USUARIO_FUNCAO,
        u.SETOR AS USUARIO_SETOR,
        tc.CRIADO_EM AS INSCRITO_EM,
        COUNT(DISTINCT CASE
          WHEN ut.TIPO = 'video' THEN CONCAT(CONVERT(VARCHAR(36), ut.MATERIAL_ID), ':', ISNULL(CONVERT(VARCHAR(10), ut.MATERIAL_VERSAO), ''))
          ELSE NULL
        END) AS VIDEOS_CONCLUIDOS,
        MAX(ut.DT_CONCLUSAO) AS ULTIMA_CONCLUSAO
      FROM dbo.TTURMA_COLABORADORES tc
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = tc.USUARIO_CPF
      LEFT JOIN dbo.TUSUARIO_TREINAMENTOS ut
        ON ut.TURMA_ID = tc.TURMA_ID
        AND ut.USUARIO_CPF = tc.USUARIO_CPF
        AND ut.ARQUIVADO_EM IS NULL
      WHERE tc.TURMA_ID = @TURMA_ID
      GROUP BY
        tc.TURMA_ID,
        tc.USUARIO_CPF,
        u.NOME,
        u.CARGO,
        u.SETOR,
        tc.CRIADO_EM
      ORDER BY
        u.NOME ASC,
        tc.USUARIO_CPF ASC
    `)

  return result.recordset as TurmaParticipantRecord[]
}

export async function saveTurmaEncerramentoEvidencias(input: {
  turmaId: string
  duracaoTreinamentoMinutos: number
  finalizadoEm?: Date | null
  criadoPor?: string | null
  evidencias: Array<{ arquivoPath: string }>
}) {
  await ensureTurmaEvidenciaSchema()

  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    await new sql.Request(transaction)
      .input("TURMA_ID", sql.UniqueIdentifier, input.turmaId)
      .input("DURACAO_TREINAMENTO_MINUTOS", sql.Int, input.duracaoTreinamentoMinutos)
      .input("FINALIZADO_EM", sql.DateTime2, input.finalizadoEm ?? new Date())
      .query(`
        UPDATE dbo.TTURMAS_TREINAMENTO
        SET
          DURACAO_TREINAMENTO_MINUTOS = @DURACAO_TREINAMENTO_MINUTOS,
          FINALIZADO_EM = @FINALIZADO_EM,
          STATUS = 'finalizada'
        WHERE ID = @TURMA_ID
      `)

    await new sql.Request(transaction)
      .input("TURMA_ID", sql.UniqueIdentifier, input.turmaId)
      .query(`DELETE FROM dbo.TTURMA_EVIDENCIAS WHERE TURMA_ID = @TURMA_ID`)

    for (let index = 0; index < input.evidencias.length; index += 1) {
      const evid = input.evidencias[index]
      await new sql.Request(transaction)
        .input("ID", sql.UniqueIdentifier, randomUUID())
        .input("TURMA_ID", sql.UniqueIdentifier, input.turmaId)
        .input("ARQUIVO_PATH", sql.NVarChar(1000), evid.arquivoPath)
        .input("CRIADO_POR", sql.VarChar(100), input.criadoPor ?? null)
        .input("ORDEM", sql.Int, index + 1)
        .query(`
          INSERT INTO dbo.TTURMA_EVIDENCIAS (
            ID,
            TURMA_ID,
            ARQUIVO_PATH,
            CRIADO_POR,
            ORDEM
          ) VALUES (
            @ID,
            @TURMA_ID,
            @ARQUIVO_PATH,
            @CRIADO_POR,
            @ORDEM
          )
        `)
    }

    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }

  return getTurmaById(input.turmaId)
}

export async function getCollectiveTrainingHoursMonthlySummaryLast12Months(referenceDate: Date = new Date()) {
  const pool = await getPool()
  const schemaCheck = await pool.request().query(`
    SELECT COL_LENGTH('dbo.TTURMAS_TREINAMENTO', 'DURACAO_TREINAMENTO_MINUTOS') AS HAS_DURACAO
  `)

  if (!schemaCheck.recordset[0]?.HAS_DURACAO) {
    return [] as CollectiveTrainingHoursMonthlyRow[]
  }

  const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const rangeStart = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - 11, 1)

  const result = await pool
    .request()
    .input("RANGE_START", sql.DateTime2, rangeStart)
    .query(`
      SELECT
        YEAR(COALESCE(t.FINALIZADO_EM, t.INICIADO_EM, t.CRIADO_EM)) AS ANO,
        MONTH(COALESCE(t.FINALIZADO_EM, t.INICIADO_EM, t.CRIADO_EM)) AS MES,
        CAST(SUM(CAST(ISNULL(t.DURACAO_TREINAMENTO_MINUTOS, 0) AS DECIMAL(18, 2))) / 60.0 AS DECIMAL(18, 2)) AS TOTAL_HORAS
      FROM dbo.TTURMAS_TREINAMENTO t
      WHERE ISNULL(t.DURACAO_TREINAMENTO_MINUTOS, 0) > 0
        AND COALESCE(t.FINALIZADO_EM, t.INICIADO_EM, t.CRIADO_EM) >= @RANGE_START
      GROUP BY
        YEAR(COALESCE(t.FINALIZADO_EM, t.INICIADO_EM, t.CRIADO_EM)),
        MONTH(COALESCE(t.FINALIZADO_EM, t.INICIADO_EM, t.CRIADO_EM))
      ORDER BY ANO, MES
    `)

  return result.recordset as CollectiveTrainingHoursMonthlyRow[]
}
