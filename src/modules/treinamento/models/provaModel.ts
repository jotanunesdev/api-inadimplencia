import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type ProvaRecord = {
  ID: string
  TRILHA_FK_ID: string
  PROVA_PATH: string | null
  VERSAO: number
  TITULO: string | null
  NOTA_TOTAL: number | null
  ATUALIZADO_EM: Date | null
}

export const OBJECTIVE_PLACEHOLDER_PATH = "__PROVA_OBJETIVA__"

export async function listProvas(
  trilhaId?: string,
  cpf?: string,
  includeObjective = false,
) {
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

  if (!includeObjective) {
    request.input(
      "OBJECTIVE_PLACEHOLDER_PATH",
      sql.NVarChar(1000),
      OBJECTIVE_PLACEHOLDER_PATH,
    )
    conditions.push("p.PROVA_PATH <> @OBJECTIVE_PLACEHOLDER_PATH")
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await request.query(`
    SELECT ID, TRILHA_FK_ID, PROVA_PATH, VERSAO, TITULO, NOTA_TOTAL, ATUALIZADO_EM
    FROM (
      SELECT
        p.ID,
        p.TRILHA_FK_ID,
        p.PROVA_PATH,
        p.VERSAO,
        p.TITULO,
        p.NOTA_TOTAL,
        p.ATUALIZADO_EM,
        ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
      FROM dbo.TPROVAS p
      ${join}
      ${where}
    ) p
    WHERE p.RN = 1
    ORDER BY p.ATUALIZADO_EM DESC
  `)
  return result.recordset as ProvaRecord[]
}

export async function getProvaById(id: string, versao?: number) {
  const pool = await getPool()
  const request = pool.request().input("ID", sql.UniqueIdentifier, id)

  if (versao !== undefined) {
    request.input("VERSAO", sql.Int, versao)
    const result = await request.query(
      "SELECT * FROM dbo.TPROVAS WHERE ID = @ID AND VERSAO = @VERSAO",
    )
    return result.recordset[0] as ProvaRecord | undefined
  }

  const result = await request.query(
    "SELECT TOP 1 * FROM dbo.TPROVAS WHERE ID = @ID ORDER BY VERSAO DESC",
  )

  return result.recordset[0] as ProvaRecord | undefined
}

export async function getProvaByTrilhaId(trilhaId: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("TRILHA_FK_ID", sql.UniqueIdentifier, trilhaId)
    .input(
      "OBJECTIVE_PLACEHOLDER_PATH",
      sql.NVarChar(1000),
      OBJECTIVE_PLACEHOLDER_PATH,
    )
    .query(`
      SELECT TOP 1 *
      FROM dbo.TPROVAS
      WHERE TRILHA_FK_ID = @TRILHA_FK_ID
        AND PROVA_PATH = @OBJECTIVE_PLACEHOLDER_PATH
      ORDER BY VERSAO DESC
    `)

  return result.recordset[0] as ProvaRecord | undefined
}

export type ProvaCreateInput = {
  id: string
  trilhaId: string
  provaPath: string
  versao?: number | null
  titulo?: string | null
  notaTotal?: number | null
  atualizadoEm?: Date | null
}

export async function createProva(input: ProvaCreateInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("TRILHA_FK_ID", sql.UniqueIdentifier, input.trilhaId)
    .input("PROVA_PATH", sql.NVarChar(1000), input.provaPath)
    .input("VERSAO", sql.Int, input.versao ?? 1)
    .input("TITULO", sql.NVarChar(255), input.titulo ?? null)
    .input("NOTA_TOTAL", sql.Decimal(5, 2), input.notaTotal ?? null)
    .input("ATUALIZADO_EM", sql.DateTime2, input.atualizadoEm ?? new Date())
    .query(
      "INSERT INTO dbo.TPROVAS (ID, TRILHA_FK_ID, PROVA_PATH, VERSAO, TITULO, NOTA_TOTAL, ATUALIZADO_EM) VALUES (@ID, @TRILHA_FK_ID, @PROVA_PATH, @VERSAO, @TITULO, @NOTA_TOTAL, @ATUALIZADO_EM)",
    )

  return getProvaById(input.id)
}

export type ProvaUpdateInput = {
  trilhaId?: string | null
  provaPath?: string | null
  versao?: number | null
  titulo?: string | null
  notaTotal?: number | null
  atualizadoEm?: Date | null
}

export async function updateProva(id: string, input: ProvaUpdateInput) {
  const pool = await getPool()
  const latest = await getProvaById(id)
  if (!latest) {
    return undefined
  }

  const requestedVersion =
    input.versao !== undefined && input.versao !== null
      ? Number(input.versao)
      : null
  const nextVersion =
    requestedVersion && Number.isFinite(requestedVersion)
      ? Math.max(requestedVersion, (latest.VERSAO ?? 0) + 1)
      : (latest.VERSAO ?? 0) + 1

  const trilhaId = input.trilhaId ?? latest.TRILHA_FK_ID
  const provaPath = input.provaPath ?? latest.PROVA_PATH
  const titulo =
    input.titulo !== undefined ? input.titulo : latest.TITULO
  const notaTotal =
    input.notaTotal !== undefined ? input.notaTotal : latest.NOTA_TOTAL
  const atualizadoEm = input.atualizadoEm ?? new Date()

  if (!provaPath) {
    throw new Error("PROVA_PATH nao pode ser nulo")
  }

  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("TRILHA_FK_ID", sql.UniqueIdentifier, trilhaId)
    .input("PROVA_PATH", sql.NVarChar(1000), provaPath)
    .input("VERSAO", sql.Int, nextVersion)
    .input("TITULO", sql.NVarChar(255), titulo ?? null)
    .input("NOTA_TOTAL", sql.Decimal(5, 2), notaTotal ?? null)
    .input("ATUALIZADO_EM", sql.DateTime2, atualizadoEm)
    .query(`
      INSERT INTO dbo.TPROVAS (
        ID,
        TRILHA_FK_ID,
        PROVA_PATH,
        VERSAO,
        TITULO,
        NOTA_TOTAL,
        ATUALIZADO_EM
      )
      VALUES (
        @ID,
        @TRILHA_FK_ID,
        @PROVA_PATH,
        @VERSAO,
        @TITULO,
        @NOTA_TOTAL,
        @ATUALIZADO_EM
      )
    `)

  return getProvaById(id)
}

export async function deleteProva(id: string) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    await new sql.Request(transaction)
      .input("PROVA_ID", sql.UniqueIdentifier, id)
      .query(`
        DELETE o
        FROM dbo.TPROVA_OPCOES o
        INNER JOIN dbo.TPROVA_QUESTOES q ON q.ID = o.QUESTAO_ID
        WHERE q.PROVA_ID = @PROVA_ID
      `)

    await new sql.Request(transaction)
      .input("PROVA_ID", sql.UniqueIdentifier, id)
      .query("DELETE FROM dbo.TPROVA_QUESTOES WHERE PROVA_ID = @PROVA_ID")

    await new sql.Request(transaction)
      .input("ID", sql.UniqueIdentifier, id)
      .query("DELETE FROM dbo.TPROVAS WHERE ID = @ID")

    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

export type ObjectiveQuestionOptionInput = {
  texto: string
  correta: boolean
}

export type ObjectiveQuestionInput = {
  enunciado: string
  peso: number
  opcoes: ObjectiveQuestionOptionInput[]
}

export type ProvaObjectiveRecord = {
  ID: string
  TRILHA_FK_ID: string
  VERSAO: number
  TITULO: string | null
  NOTA_TOTAL: number | null
  ATUALIZADO_EM: Date | null
  QUESTOES: Array<{
    ID: string
    ORDEM: number
    ENUNCIADO: string
    PESO: number
    OPCOES: Array<{
      ID: string
      ORDEM: number
      TEXTO: string
      CORRETA: boolean
    }>
  }>
}

type ObjectiveQuestionRecord = ProvaObjectiveRecord["QUESTOES"][number]
type ObjectiveOptionRecord = ObjectiveQuestionRecord["OPCOES"][number]
type ObjectiveQuestionRow = {
  ID: string
  ORDEM: number
  ENUNCIADO: string
  PESO: number
}
type ObjectiveOptionRow = {
  ID: string
  QUESTAO_ID: string
  ORDEM: number
  TEXTO: string
  CORRETA: boolean | number
}

async function fetchObjectiveProvaByVersion(
  provaId: string,
  versao: number,
): Promise<ProvaObjectiveRecord | undefined> {
  const pool = await getPool()
  const provaResult = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, provaId)
    .query(`
      SELECT ID, TRILHA_FK_ID, VERSAO, TITULO, NOTA_TOTAL, ATUALIZADO_EM
      FROM dbo.TPROVAS
      WHERE ID = @ID
    `)

  const prova = provaResult.recordset[0] as
    | Omit<ProvaObjectiveRecord, "QUESTOES">
    | undefined
  if (!prova) {
    return undefined
  }

  const questoesResult = await pool
    .request()
    .input("PROVA_ID", sql.UniqueIdentifier, provaId)
    .input("VERSAO", sql.Int, versao)
    .query(`
      SELECT ID, ORDEM, ENUNCIADO, PESO
      FROM dbo.TPROVA_QUESTOES
      WHERE PROVA_ID = @PROVA_ID
        AND VERSAO = @VERSAO
      ORDER BY ORDEM
    `)

  const questionRows = questoesResult.recordset as ObjectiveQuestionRow[]
  const questoes: ObjectiveQuestionRecord[] = questionRows.map((row) => ({
    ID: String(row.ID),
    ORDEM: Number(row.ORDEM),
    ENUNCIADO: String(row.ENUNCIADO),
    PESO: Number(row.PESO),
    OPCOES: [] as ObjectiveOptionRecord[],
  }))

  if (questoes.length > 0) {
    const opcoesResult = await pool
      .request()
      .input("PROVA_ID", sql.UniqueIdentifier, provaId)
      .input("VERSAO", sql.Int, versao)
      .query(`
        SELECT o.ID, o.QUESTAO_ID, o.ORDEM, o.TEXTO, o.CORRETA
        FROM dbo.TPROVA_OPCOES o
        JOIN dbo.TPROVA_QUESTOES q ON q.ID = o.QUESTAO_ID
        WHERE q.PROVA_ID = @PROVA_ID
          AND q.VERSAO = @VERSAO
        ORDER BY q.ORDEM, o.ORDEM
      `)

    const optionRows = opcoesResult.recordset as ObjectiveOptionRow[]
    const questionMap = new Map<string, ObjectiveQuestionRecord>(
      questoes.map((questao) => [questao.ID, questao]),
    )
    for (const row of optionRows) {
      const question = questionMap.get(String(row.QUESTAO_ID))
      if (!question) continue
      question.OPCOES.push({
        ID: String(row.ID),
        ORDEM: Number(row.ORDEM),
        TEXTO: String(row.TEXTO),
        CORRETA: Boolean(row.CORRETA),
      })
    }
  }

  return {
    ...prova,
    QUESTOES: questoes,
  }
}

export async function getObjectiveProvaByTrilhaId(
  trilhaId: string,
  versao?: number,
) {
  const prova = await getProvaByTrilhaId(trilhaId)
  if (!prova) {
    return undefined
  }

  const targetVersion = versao ?? prova.VERSAO
  return fetchObjectiveProvaByVersion(prova.ID, targetVersion)
}

export async function trilhaHasObjectiveProva(trilhaId: string) {
  const prova = await getProvaByTrilhaId(trilhaId)
  if (!prova) return false

  const pool = await getPool()
  const result = await pool
    .request()
    .input("PROVA_ID", sql.UniqueIdentifier, prova.ID)
    .input("VERSAO", sql.Int, prova.VERSAO)
    .query(`
      SELECT COUNT(1) AS TOTAL
      FROM dbo.TPROVA_QUESTOES
      WHERE PROVA_ID = @PROVA_ID
        AND VERSAO = @VERSAO
    `)

  return Number(result.recordset[0]?.TOTAL ?? 0) > 0
}

export async function createOrVersionObjectiveProva(input: {
  trilhaId: string
  titulo: string
  notaTotal: number
  questoes: ObjectiveQuestionInput[]
}) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    const request = new sql.Request(transaction)
    const currentResult = await request
      .input("TRILHA_FK_ID", sql.UniqueIdentifier, input.trilhaId)
      .query(`
        SELECT TOP 1 ID, VERSAO
        FROM dbo.TPROVAS
        WHERE TRILHA_FK_ID = @TRILHA_FK_ID
        ORDER BY VERSAO DESC
      `)

    const current = currentResult.recordset[0] as
      | { ID: string; VERSAO: number | null }
      | undefined

    const provaId = current?.ID ?? randomUUID()
    const nextVersion = (current?.VERSAO ?? 0) + 1

    if (!current) {
      await new sql.Request(transaction)
        .input("ID", sql.UniqueIdentifier, provaId)
        .input("TRILHA_FK_ID", sql.UniqueIdentifier, input.trilhaId)
        .input(
          "PROVA_PATH",
          sql.NVarChar(1000),
          OBJECTIVE_PLACEHOLDER_PATH,
        )
        .input("VERSAO", sql.Int, nextVersion)
        .input("TITULO", sql.NVarChar(255), input.titulo)
        .input("NOTA_TOTAL", sql.Decimal(5, 2), input.notaTotal)
        .input("ATUALIZADO_EM", sql.DateTime2, new Date())
        .query(`
          INSERT INTO dbo.TPROVAS (ID, TRILHA_FK_ID, PROVA_PATH, VERSAO, TITULO, NOTA_TOTAL, ATUALIZADO_EM)
          VALUES (@ID, @TRILHA_FK_ID, @PROVA_PATH, @VERSAO, @TITULO, @NOTA_TOTAL, @ATUALIZADO_EM)
        `)
    } else {
      await new sql.Request(transaction)
        .input("ID", sql.UniqueIdentifier, provaId)
        .input("VERSAO", sql.Int, nextVersion)
        .input("TITULO", sql.NVarChar(255), input.titulo)
        .input("NOTA_TOTAL", sql.Decimal(5, 2), input.notaTotal)
        .input("ATUALIZADO_EM", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.TPROVAS
          SET VERSAO = @VERSAO,
              TITULO = @TITULO,
              NOTA_TOTAL = @NOTA_TOTAL,
              ATUALIZADO_EM = @ATUALIZADO_EM
          WHERE ID = @ID
        `)
    }

    for (let qIndex = 0; qIndex < input.questoes.length; qIndex += 1) {
      const questao = input.questoes[qIndex]
      const questaoId = randomUUID()

      await new sql.Request(transaction)
        .input("ID", sql.UniqueIdentifier, questaoId)
        .input("PROVA_ID", sql.UniqueIdentifier, provaId)
        .input("VERSAO", sql.Int, nextVersion)
        .input("ORDEM", sql.Int, qIndex + 1)
        .input("ENUNCIADO", sql.NVarChar(2000), questao.enunciado)
        .input("PESO", sql.Decimal(5, 2), questao.peso)
        .query(`
          INSERT INTO dbo.TPROVA_QUESTOES (ID, PROVA_ID, VERSAO, ORDEM, ENUNCIADO, PESO)
          VALUES (@ID, @PROVA_ID, @VERSAO, @ORDEM, @ENUNCIADO, @PESO)
        `)

      for (let oIndex = 0; oIndex < questao.opcoes.length; oIndex += 1) {
        const opcao = questao.opcoes[oIndex]
        await new sql.Request(transaction)
          .input("ID", sql.UniqueIdentifier, randomUUID())
          .input("QUESTAO_ID", sql.UniqueIdentifier, questaoId)
          .input("ORDEM", sql.Int, oIndex + 1)
          .input("TEXTO", sql.NVarChar(1000), opcao.texto)
          .input("CORRETA", sql.Bit, opcao.correta ? 1 : 0)
          .query(`
            INSERT INTO dbo.TPROVA_OPCOES (ID, QUESTAO_ID, ORDEM, TEXTO, CORRETA)
            VALUES (@ID, @QUESTAO_ID, @ORDEM, @TEXTO, @CORRETA)
          `)
      }
    }

    await transaction.commit()
    return fetchObjectiveProvaByVersion(provaId, nextVersion)
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}
