import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type ProcedimentoProvaQuestaoInput = {
  enunciado: string
  peso: number
  opcoes: Array<{
    texto: string
    correta: boolean
  }>
}

export type ProcedimentoProvaQuestaoRecord = {
  ID: string
  PROCEDIMENTO_ID: string
  PROCEDIMENTO_VERSAO: number
  ORDEM: number
  ENUNCIADO: string
  PESO: number
  PROCEDIMENTO_NOME: string | null
  OPCOES: Array<{
    ID: string
    ORDEM: number
    TEXTO: string
    CORRETA: boolean
  }>
}

type QuestaoRow = {
  ID: string
  PROCEDIMENTO_ID: string
  PROCEDIMENTO_VERSAO: number
  ORDEM: number
  ENUNCIADO: string
  PESO: number
  PROCEDIMENTO_NOME: string | null
}

type OpcaoRow = {
  ID: string
  QUESTAO_ID: string
  ORDEM: number
  TEXTO: string
  CORRETA: boolean | number
}

async function procedimentoProvaSchemaExists() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      OBJECT_ID('dbo.TPROCEDIMENTO_PROVA_QUESTOES', 'U') AS QUESTOES_ID,
      OBJECT_ID('dbo.TPROCEDIMENTO_PROVA_OPCOES', 'U') AS OPCOES_ID
  `)

  return Boolean(
    result.recordset[0]?.QUESTOES_ID &&
      result.recordset[0]?.OPCOES_ID,
  )
}

export async function replaceProcedimentoProvaQuestoes(
  procedimentoId: string,
  procedimentoVersao: number,
  questoes: ProcedimentoProvaQuestaoInput[],
) {
  const hasSchema = await procedimentoProvaSchemaExists()
  if (!hasSchema) {
    throw new Error(
      "Schema de prova de procedimento nao encontrado. Execute o script 2026-03-05-procedimentos-provas.sql.",
    )
  }

  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    await new sql.Request(transaction)
      .input("PROCEDIMENTO_ID", sql.UniqueIdentifier, procedimentoId)
      .input("PROCEDIMENTO_VERSAO", sql.Int, procedimentoVersao)
      .query(`
        DELETE o
        FROM dbo.TPROCEDIMENTO_PROVA_OPCOES o
        INNER JOIN dbo.TPROCEDIMENTO_PROVA_QUESTOES q ON q.ID = o.QUESTAO_ID
        WHERE q.PROCEDIMENTO_ID = @PROCEDIMENTO_ID
          AND q.PROCEDIMENTO_VERSAO = @PROCEDIMENTO_VERSAO
      `)

    await new sql.Request(transaction)
      .input("PROCEDIMENTO_ID", sql.UniqueIdentifier, procedimentoId)
      .input("PROCEDIMENTO_VERSAO", sql.Int, procedimentoVersao)
      .query(`
        DELETE FROM dbo.TPROCEDIMENTO_PROVA_QUESTOES
        WHERE PROCEDIMENTO_ID = @PROCEDIMENTO_ID
          AND PROCEDIMENTO_VERSAO = @PROCEDIMENTO_VERSAO
      `)

    for (let questionIndex = 0; questionIndex < questoes.length; questionIndex += 1) {
      const questao = questoes[questionIndex]
      const questaoId = randomUUID()

      // eslint-disable-next-line no-await-in-loop
      await new sql.Request(transaction)
        .input("ID", sql.UniqueIdentifier, questaoId)
        .input("PROCEDIMENTO_ID", sql.UniqueIdentifier, procedimentoId)
        .input("PROCEDIMENTO_VERSAO", sql.Int, procedimentoVersao)
        .input("ORDEM", sql.Int, questionIndex + 1)
        .input("ENUNCIADO", sql.NVarChar(2000), questao.enunciado)
        .input("PESO", sql.Decimal(8, 4), questao.peso)
        .query(`
          INSERT INTO dbo.TPROCEDIMENTO_PROVA_QUESTOES (
            ID,
            PROCEDIMENTO_ID,
            PROCEDIMENTO_VERSAO,
            ORDEM,
            ENUNCIADO,
            PESO
          )
          VALUES (
            @ID,
            @PROCEDIMENTO_ID,
            @PROCEDIMENTO_VERSAO,
            @ORDEM,
            @ENUNCIADO,
            @PESO
          )
        `)

      for (let optionIndex = 0; optionIndex < questao.opcoes.length; optionIndex += 1) {
        const opcao = questao.opcoes[optionIndex]
        // eslint-disable-next-line no-await-in-loop
        await new sql.Request(transaction)
          .input("ID", sql.UniqueIdentifier, randomUUID())
          .input("QUESTAO_ID", sql.UniqueIdentifier, questaoId)
          .input("ORDEM", sql.Int, optionIndex + 1)
          .input("TEXTO", sql.NVarChar(1000), opcao.texto)
          .input("CORRETA", sql.Bit, opcao.correta ? 1 : 0)
          .query(`
            INSERT INTO dbo.TPROCEDIMENTO_PROVA_OPCOES (
              ID,
              QUESTAO_ID,
              ORDEM,
              TEXTO,
              CORRETA
            )
            VALUES (
              @ID,
              @QUESTAO_ID,
              @ORDEM,
              @TEXTO,
              @CORRETA
            )
          `)
      }
    }

    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

export async function trilhaHasMaterialVinculadoAProcedimento(trilhaId: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("TRILHA_FK_ID", sql.UniqueIdentifier, trilhaId)
    .query(`
      WITH V_LATEST AS (
        SELECT
          v.TRILHA_FK_ID,
          v.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
        WHERE v.TRILHA_FK_ID = @TRILHA_FK_ID
      ),
      P_LATEST AS (
        SELECT
          p.TRILHA_FK_ID,
          p.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPDFS p
        WHERE p.TRILHA_FK_ID = @TRILHA_FK_ID
      )
      SELECT TOP 1 1 AS HAS_PROCEDIMENTO
      FROM (
        SELECT PROCEDIMENTO_ID FROM V_LATEST WHERE RN = 1
        UNION ALL
        SELECT PROCEDIMENTO_ID FROM P_LATEST WHERE RN = 1
      ) src
      WHERE src.PROCEDIMENTO_ID IS NOT NULL
    `)

  return Boolean(result.recordset[0]?.HAS_PROCEDIMENTO)
}

export async function listLatestProcedimentoProvaQuestoesByTrilha(
  trilhaId: string,
) {
  const hasSchema = await procedimentoProvaSchemaExists()
  if (!hasSchema) {
    return [] as ProcedimentoProvaQuestaoRecord[]
  }

  const pool = await getPool()

  const questoesResult = await pool
    .request()
    .input("TRILHA_FK_ID", sql.UniqueIdentifier, trilhaId)
    .query(`
      WITH V_LATEST AS (
        SELECT
          v.TRILHA_FK_ID,
          v.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
        WHERE v.TRILHA_FK_ID = @TRILHA_FK_ID
      ),
      P_LATEST AS (
        SELECT
          p.TRILHA_FK_ID,
          p.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPDFS p
        WHERE p.TRILHA_FK_ID = @TRILHA_FK_ID
      ),
      PROC_IDS AS (
        SELECT DISTINCT PROCEDIMENTO_ID
        FROM (
          SELECT PROCEDIMENTO_ID FROM V_LATEST WHERE RN = 1
          UNION ALL
          SELECT PROCEDIMENTO_ID FROM P_LATEST WHERE RN = 1
        ) src
        WHERE PROCEDIMENTO_ID IS NOT NULL
      ),
      PROC_LATEST AS (
        SELECT
          q.PROCEDIMENTO_ID,
          MAX(q.PROCEDIMENTO_VERSAO) AS PROCEDIMENTO_VERSAO
        FROM dbo.TPROCEDIMENTO_PROVA_QUESTOES q
        INNER JOIN PROC_IDS proc ON proc.PROCEDIMENTO_ID = q.PROCEDIMENTO_ID
        GROUP BY q.PROCEDIMENTO_ID
      )
      SELECT
        q.ID,
        q.PROCEDIMENTO_ID,
        q.PROCEDIMENTO_VERSAO,
        q.ORDEM,
        q.ENUNCIADO,
        q.PESO,
        procNome.NOME AS PROCEDIMENTO_NOME
      FROM dbo.TPROCEDIMENTO_PROVA_QUESTOES q
      INNER JOIN PROC_LATEST latest
        ON latest.PROCEDIMENTO_ID = q.PROCEDIMENTO_ID
       AND latest.PROCEDIMENTO_VERSAO = q.PROCEDIMENTO_VERSAO
      OUTER APPLY (
        SELECT TOP 1 p.NOME
        FROM dbo.TPROCEDIMENTOS p
        WHERE p.ID = q.PROCEDIMENTO_ID
        ORDER BY p.VERSAO DESC
      ) procNome
      ORDER BY q.PROCEDIMENTO_ID, q.ORDEM
    `)

  const questoes = questoesResult.recordset as QuestaoRow[]
  if (!questoes.length) {
    return [] as ProcedimentoProvaQuestaoRecord[]
  }

  const opcoesResult = await pool
    .request()
    .input("TRILHA_FK_ID", sql.UniqueIdentifier, trilhaId)
    .query(`
      WITH V_LATEST AS (
        SELECT
          v.TRILHA_FK_ID,
          v.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
        WHERE v.TRILHA_FK_ID = @TRILHA_FK_ID
      ),
      P_LATEST AS (
        SELECT
          p.TRILHA_FK_ID,
          p.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPDFS p
        WHERE p.TRILHA_FK_ID = @TRILHA_FK_ID
      ),
      PROC_IDS AS (
        SELECT DISTINCT PROCEDIMENTO_ID
        FROM (
          SELECT PROCEDIMENTO_ID FROM V_LATEST WHERE RN = 1
          UNION ALL
          SELECT PROCEDIMENTO_ID FROM P_LATEST WHERE RN = 1
        ) src
        WHERE PROCEDIMENTO_ID IS NOT NULL
      ),
      PROC_LATEST AS (
        SELECT
          q.PROCEDIMENTO_ID,
          MAX(q.PROCEDIMENTO_VERSAO) AS PROCEDIMENTO_VERSAO
        FROM dbo.TPROCEDIMENTO_PROVA_QUESTOES q
        INNER JOIN PROC_IDS proc ON proc.PROCEDIMENTO_ID = q.PROCEDIMENTO_ID
        GROUP BY q.PROCEDIMENTO_ID
      ),
      TARGET_QUESTOES AS (
        SELECT q.ID
        FROM dbo.TPROCEDIMENTO_PROVA_QUESTOES q
        INNER JOIN PROC_LATEST latest
          ON latest.PROCEDIMENTO_ID = q.PROCEDIMENTO_ID
         AND latest.PROCEDIMENTO_VERSAO = q.PROCEDIMENTO_VERSAO
      )
      SELECT
        o.ID,
        o.QUESTAO_ID,
        o.ORDEM,
        o.TEXTO,
        o.CORRETA
      FROM dbo.TPROCEDIMENTO_PROVA_OPCOES o
      INNER JOIN TARGET_QUESTOES t ON t.ID = o.QUESTAO_ID
      ORDER BY o.QUESTAO_ID, o.ORDEM
    `)

  const opcoes = opcoesResult.recordset as OpcaoRow[]
  const questoesMap = new Map<string, ProcedimentoProvaQuestaoRecord>(
    questoes.map((questao) => [
      questao.ID,
      {
        ID: questao.ID,
        PROCEDIMENTO_ID: questao.PROCEDIMENTO_ID,
        PROCEDIMENTO_VERSAO: Number(questao.PROCEDIMENTO_VERSAO),
        ORDEM: Number(questao.ORDEM),
        ENUNCIADO: String(questao.ENUNCIADO),
        PESO: Number(questao.PESO),
        PROCEDIMENTO_NOME: questao.PROCEDIMENTO_NOME,
        OPCOES: [],
      },
    ]),
  )

  for (const opcao of opcoes) {
    const questao = questoesMap.get(String(opcao.QUESTAO_ID))
    if (!questao) continue
    questao.OPCOES.push({
      ID: String(opcao.ID),
      ORDEM: Number(opcao.ORDEM),
      TEXTO: String(opcao.TEXTO),
      CORRETA: Boolean(opcao.CORRETA),
    })
  }

  return Array.from(questoesMap.values())
}
