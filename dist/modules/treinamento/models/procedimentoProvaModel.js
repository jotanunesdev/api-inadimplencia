"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceProcedimentoProvaQuestoes = replaceProcedimentoProvaQuestoes;
exports.trilhaHasMaterialVinculadoAProcedimento = trilhaHasMaterialVinculadoAProcedimento;
exports.listLatestProcedimentoProvaQuestoesByTrilha = listLatestProcedimentoProvaQuestoesByTrilha;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
async function procedimentoProvaSchemaExists() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT
      OBJECT_ID('dbo.TPROCEDIMENTO_PROVA_QUESTOES', 'U') AS QUESTOES_ID,
      OBJECT_ID('dbo.TPROCEDIMENTO_PROVA_OPCOES', 'U') AS OPCOES_ID
  `);
    return Boolean(result.recordset[0]?.QUESTOES_ID &&
        result.recordset[0]?.OPCOES_ID);
}
async function replaceProcedimentoProvaQuestoes(procedimentoId, procedimentoVersao, questoes) {
    const hasSchema = await procedimentoProvaSchemaExists();
    if (!hasSchema) {
        throw new Error("Schema de prova de procedimento nao encontrado. Execute o script 2026-03-05-procedimentos-provas.sql.");
    }
    const pool = await (0, db_1.getPool)();
    const transaction = new db_1.sql.Transaction(pool);
    await transaction.begin();
    try {
        await new db_1.sql.Request(transaction)
            .input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, procedimentoId)
            .input("PROCEDIMENTO_VERSAO", db_1.sql.Int, procedimentoVersao)
            .query(`
        DELETE o
        FROM dbo.TPROCEDIMENTO_PROVA_OPCOES o
        INNER JOIN dbo.TPROCEDIMENTO_PROVA_QUESTOES q ON q.ID = o.QUESTAO_ID
        WHERE q.PROCEDIMENTO_ID = @PROCEDIMENTO_ID
          AND q.PROCEDIMENTO_VERSAO = @PROCEDIMENTO_VERSAO
      `);
        await new db_1.sql.Request(transaction)
            .input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, procedimentoId)
            .input("PROCEDIMENTO_VERSAO", db_1.sql.Int, procedimentoVersao)
            .query(`
        DELETE FROM dbo.TPROCEDIMENTO_PROVA_QUESTOES
        WHERE PROCEDIMENTO_ID = @PROCEDIMENTO_ID
          AND PROCEDIMENTO_VERSAO = @PROCEDIMENTO_VERSAO
      `);
        for (let questionIndex = 0; questionIndex < questoes.length; questionIndex += 1) {
            const questao = questoes[questionIndex];
            const questaoId = (0, crypto_1.randomUUID)();
            // eslint-disable-next-line no-await-in-loop
            await new db_1.sql.Request(transaction)
                .input("ID", db_1.sql.UniqueIdentifier, questaoId)
                .input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, procedimentoId)
                .input("PROCEDIMENTO_VERSAO", db_1.sql.Int, procedimentoVersao)
                .input("ORDEM", db_1.sql.Int, questionIndex + 1)
                .input("ENUNCIADO", db_1.sql.NVarChar(2000), questao.enunciado)
                .input("PESO", db_1.sql.Decimal(8, 4), questao.peso)
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
        `);
            for (let optionIndex = 0; optionIndex < questao.opcoes.length; optionIndex += 1) {
                const opcao = questao.opcoes[optionIndex];
                // eslint-disable-next-line no-await-in-loop
                await new db_1.sql.Request(transaction)
                    .input("ID", db_1.sql.UniqueIdentifier, (0, crypto_1.randomUUID)())
                    .input("QUESTAO_ID", db_1.sql.UniqueIdentifier, questaoId)
                    .input("ORDEM", db_1.sql.Int, optionIndex + 1)
                    .input("TEXTO", db_1.sql.NVarChar(1000), opcao.texto)
                    .input("CORRETA", db_1.sql.Bit, opcao.correta ? 1 : 0)
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
          `);
            }
        }
        await transaction.commit();
    }
    catch (error) {
        await transaction.rollback();
        throw error;
    }
}
async function trilhaHasMaterialVinculadoAProcedimento(trilhaId) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, trilhaId)
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
    `);
    return Boolean(result.recordset[0]?.HAS_PROCEDIMENTO);
}
async function listLatestProcedimentoProvaQuestoesByTrilha(trilhaId) {
    const hasSchema = await procedimentoProvaSchemaExists();
    if (!hasSchema) {
        return [];
    }
    const pool = await (0, db_1.getPool)();
    const questoesResult = await pool
        .request()
        .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, trilhaId)
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
    `);
    const questoes = questoesResult.recordset;
    if (!questoes.length) {
        return [];
    }
    const opcoesResult = await pool
        .request()
        .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, trilhaId)
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
    `);
    const opcoes = opcoesResult.recordset;
    const questoesMap = new Map(questoes.map((questao) => [
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
    ]));
    for (const opcao of opcoes) {
        const questao = questoesMap.get(String(opcao.QUESTAO_ID));
        if (!questao)
            continue;
        questao.OPCOES.push({
            ID: String(opcao.ID),
            ORDEM: Number(opcao.ORDEM),
            TEXTO: String(opcao.TEXTO),
            CORRETA: Boolean(opcao.CORRETA),
        });
    }
    return Array.from(questoesMap.values());
}
