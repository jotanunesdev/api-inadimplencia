"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVA_MODO_APLICACAO = exports.EFFICACY_PLACEHOLDER_PATH = exports.OBJECTIVE_PLACEHOLDER_PATH = void 0;
exports.normalizeProvaModoAplicacao = normalizeProvaModoAplicacao;
exports.listProvas = listProvas;
exports.getProvaById = getProvaById;
exports.getProvaByTrilhaId = getProvaByTrilhaId;
exports.createProva = createProva;
exports.updateProva = updateProva;
exports.deleteProva = deleteProva;
exports.getObjectiveProvaByTrilhaId = getObjectiveProvaByTrilhaId;
exports.getEfficacyProvaByTrilhaId = getEfficacyProvaByTrilhaId;
exports.getObjectiveProvaForExecutionByTrilhaId = getObjectiveProvaForExecutionByTrilhaId;
exports.proofExecutionMustBeCollective = proofExecutionMustBeCollective;
exports.trilhaHasObjectiveProva = trilhaHasObjectiveProva;
exports.createOrVersionObjectiveProva = createOrVersionObjectiveProva;
exports.createOrVersionEfficacyProva = createOrVersionEfficacyProva;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const procedimentoProvaModel_1 = require("./procedimentoProvaModel");
exports.OBJECTIVE_PLACEHOLDER_PATH = "__PROVA_OBJETIVA__";
exports.EFFICACY_PLACEHOLDER_PATH = "__PROVA_EFICACIA__";
exports.PROVA_MODO_APLICACAO = {
    COLETIVA: "coletiva",
    INDIVIDUAL: "individual",
};
let ensureProvaSchemaPromise = null;
function normalizeProvaModoAplicacao(value) {
    return String(value).toLowerCase() === exports.PROVA_MODO_APLICACAO.INDIVIDUAL
        ? exports.PROVA_MODO_APLICACAO.INDIVIDUAL
        : exports.PROVA_MODO_APLICACAO.COLETIVA;
}
async function ensureProvaSchemaSupportsMultipleProofTypes() {
    if (!ensureProvaSchemaPromise) {
        ensureProvaSchemaPromise = (async () => {
            const pool = await (0, db_1.getPool)();
            await pool.request().query(`
        IF EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TPROVAS')
            AND name = 'UX_TPROVAS_TRILHA'
        )
        BEGIN
          DROP INDEX UX_TPROVAS_TRILHA ON dbo.TPROVAS
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TPROVAS')
            AND name = 'IX_TPROVAS_ID_VERSAO'
        )
        BEGIN
          CREATE INDEX IX_TPROVAS_ID_VERSAO
            ON dbo.TPROVAS (ID, VERSAO DESC)
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TPROVAS')
            AND name = 'IX_TPROVAS_TRILHA_FK_ID'
        )
        BEGIN
          CREATE INDEX IX_TPROVAS_TRILHA_FK_ID
            ON dbo.TPROVAS (TRILHA_FK_ID, VERSAO DESC)
        END

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.TPROVAS')
            AND name = 'IX_TPROVAS_TRILHA_PATH'
        )
        BEGIN
          CREATE INDEX IX_TPROVAS_TRILHA_PATH
            ON dbo.TPROVAS (TRILHA_FK_ID, PROVA_PATH, VERSAO DESC)
        END
      `);
        })().finally(() => {
            ensureProvaSchemaPromise = null;
        });
    }
    await ensureProvaSchemaPromise;
}
async function listProvas(trilhaId, cpf, includeObjective = false) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const conditions = [];
    let join = "";
    if (cpf) {
        request.input("USUARIO_CPF", db_1.sql.VarChar(100), cpf);
        join = "JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = p.TRILHA_FK_ID";
        conditions.push("ut.USUARIO_CPF = @USUARIO_CPF");
    }
    if (trilhaId) {
        request.input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, trilhaId);
        conditions.push("p.TRILHA_FK_ID = @TRILHA_FK_ID");
    }
    if (!includeObjective) {
        request.input("OBJECTIVE_PLACEHOLDER_PATH", db_1.sql.NVarChar(1000), exports.OBJECTIVE_PLACEHOLDER_PATH);
        conditions.push("p.PROVA_PATH <> @OBJECTIVE_PLACEHOLDER_PATH");
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await request.query(`
    SELECT
      ID,
      TRILHA_FK_ID,
      PROVA_PATH,
      VERSAO,
      MODO_APLICACAO,
      TITULO,
      NOTA_TOTAL,
      ATUALIZADO_EM
    FROM (
      SELECT
        p.ID,
        p.TRILHA_FK_ID,
        p.PROVA_PATH,
        p.VERSAO,
        p.MODO_APLICACAO,
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
  `);
    return result.recordset;
}
async function getProvaById(id, versao) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request().input("ID", db_1.sql.UniqueIdentifier, id);
    if (versao !== undefined) {
        request.input("VERSAO", db_1.sql.Int, versao);
        const result = await request.query("SELECT * FROM dbo.TPROVAS WHERE ID = @ID AND VERSAO = @VERSAO");
        return result.recordset[0];
    }
    const result = await request.query("SELECT TOP 1 * FROM dbo.TPROVAS WHERE ID = @ID ORDER BY VERSAO DESC");
    return result.recordset[0];
}
async function getProvaByTrilhaId(trilhaId, proofPath = exports.OBJECTIVE_PLACEHOLDER_PATH) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, trilhaId)
        .input("PROVA_PATH", db_1.sql.NVarChar(1000), proofPath)
        .query(`
      SELECT TOP 1 *
      FROM dbo.TPROVAS
      WHERE TRILHA_FK_ID = @TRILHA_FK_ID
        AND PROVA_PATH = @PROVA_PATH
      ORDER BY VERSAO DESC
    `);
    return result.recordset[0];
}
async function createProva(input) {
    await ensureProvaSchemaSupportsMultipleProofTypes();
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.id)
        .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, input.trilhaId)
        .input("PROVA_PATH", db_1.sql.NVarChar(1000), input.provaPath)
        .input("VERSAO", db_1.sql.Int, input.versao ?? 1)
        .input("MODO_APLICACAO", db_1.sql.VarChar(20), normalizeProvaModoAplicacao(input.modoAplicacao))
        .input("TITULO", db_1.sql.NVarChar(255), input.titulo ?? null)
        .input("NOTA_TOTAL", db_1.sql.Decimal(5, 2), input.notaTotal ?? null)
        .input("ATUALIZADO_EM", db_1.sql.DateTime2, input.atualizadoEm ?? new Date())
        .query("INSERT INTO dbo.TPROVAS (ID, TRILHA_FK_ID, PROVA_PATH, VERSAO, MODO_APLICACAO, TITULO, NOTA_TOTAL, ATUALIZADO_EM) VALUES (@ID, @TRILHA_FK_ID, @PROVA_PATH, @VERSAO, @MODO_APLICACAO, @TITULO, @NOTA_TOTAL, @ATUALIZADO_EM)");
    return getProvaById(input.id);
}
async function updateProva(id, input) {
    await ensureProvaSchemaSupportsMultipleProofTypes();
    const pool = await (0, db_1.getPool)();
    const latest = await getProvaById(id);
    if (!latest) {
        return undefined;
    }
    const requestedVersion = input.versao !== undefined && input.versao !== null
        ? Number(input.versao)
        : null;
    const nextVersion = requestedVersion && Number.isFinite(requestedVersion)
        ? Math.max(requestedVersion, (latest.VERSAO ?? 0) + 1)
        : (latest.VERSAO ?? 0) + 1;
    const trilhaId = input.trilhaId ?? latest.TRILHA_FK_ID;
    const provaPath = input.provaPath ?? latest.PROVA_PATH;
    const modoAplicacao = normalizeProvaModoAplicacao(input.modoAplicacao ?? latest.MODO_APLICACAO);
    const titulo = input.titulo !== undefined ? input.titulo : latest.TITULO;
    const notaTotal = input.notaTotal !== undefined ? input.notaTotal : latest.NOTA_TOTAL;
    const atualizadoEm = input.atualizadoEm ?? new Date();
    if (!provaPath) {
        throw new Error("PROVA_PATH nao pode ser nulo");
    }
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, trilhaId)
        .input("PROVA_PATH", db_1.sql.NVarChar(1000), provaPath)
        .input("VERSAO", db_1.sql.Int, nextVersion)
        .input("MODO_APLICACAO", db_1.sql.VarChar(20), modoAplicacao)
        .input("TITULO", db_1.sql.NVarChar(255), titulo ?? null)
        .input("NOTA_TOTAL", db_1.sql.Decimal(5, 2), notaTotal ?? null)
        .input("ATUALIZADO_EM", db_1.sql.DateTime2, atualizadoEm)
        .query(`
      INSERT INTO dbo.TPROVAS (
        ID,
        TRILHA_FK_ID,
        PROVA_PATH,
        VERSAO,
        MODO_APLICACAO,
        TITULO,
        NOTA_TOTAL,
        ATUALIZADO_EM
      )
      VALUES (
        @ID,
        @TRILHA_FK_ID,
        @PROVA_PATH,
        @VERSAO,
        @MODO_APLICACAO,
        @TITULO,
        @NOTA_TOTAL,
        @ATUALIZADO_EM
      )
    `);
    return getProvaById(id);
}
async function deleteProva(id) {
    const pool = await (0, db_1.getPool)();
    const transaction = new db_1.sql.Transaction(pool);
    await transaction.begin();
    try {
        await new db_1.sql.Request(transaction)
            .input("PROVA_ID", db_1.sql.UniqueIdentifier, id)
            .query(`
        DELETE o
        FROM dbo.TPROVA_OPCOES o
        INNER JOIN dbo.TPROVA_QUESTOES q ON q.ID = o.QUESTAO_ID
        WHERE q.PROVA_ID = @PROVA_ID
      `);
        await new db_1.sql.Request(transaction)
            .input("PROVA_ID", db_1.sql.UniqueIdentifier, id)
            .query("DELETE FROM dbo.TPROVA_QUESTOES WHERE PROVA_ID = @PROVA_ID");
        await new db_1.sql.Request(transaction)
            .input("ID", db_1.sql.UniqueIdentifier, id)
            .query("DELETE FROM dbo.TPROVAS WHERE ID = @ID");
        await transaction.commit();
    }
    catch (error) {
        await transaction.rollback();
        throw error;
    }
}
const round2 = (value) => Math.round(value * 100) / 100;
function normalizeObjectiveQuestionWeights(questions) {
    if (!questions.length) {
        return questions;
    }
    const rawWeights = questions.map((question) => Number.isFinite(Number(question.PESO)) && Number(question.PESO) > 0
        ? Number(question.PESO)
        : 1);
    const totalRaw = rawWeights.reduce((sum, value) => sum + value, 0);
    if (totalRaw <= 0) {
        return questions;
    }
    const scale = 10 / totalRaw;
    let accumulated = 0;
    return questions.map((question, index) => {
        if (index === questions.length - 1) {
            const remaining = round2(10 - accumulated);
            return {
                ...question,
                PESO: remaining > 0 ? remaining : 0.01,
            };
        }
        const normalized = round2(rawWeights[index] * scale);
        accumulated += normalized;
        return {
            ...question,
            PESO: normalized > 0 ? normalized : 0.01,
        };
    });
}
async function fetchObjectiveProvaByVersion(provaId, versao) {
    const pool = await (0, db_1.getPool)();
    const provaResult = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, provaId)
        .query(`
      SELECT ID, TRILHA_FK_ID, VERSAO, TITULO, NOTA_TOTAL, ATUALIZADO_EM
      , MODO_APLICACAO
      FROM dbo.TPROVAS
      WHERE ID = @ID
    `);
    const prova = provaResult.recordset[0];
    if (!prova) {
        return undefined;
    }
    const questoesResult = await pool
        .request()
        .input("PROVA_ID", db_1.sql.UniqueIdentifier, provaId)
        .input("VERSAO", db_1.sql.Int, versao)
        .query(`
      SELECT ID, ORDEM, ENUNCIADO, PESO
      FROM dbo.TPROVA_QUESTOES
      WHERE PROVA_ID = @PROVA_ID
        AND VERSAO = @VERSAO
      ORDER BY ORDEM
    `);
    const questionRows = questoesResult.recordset;
    const questoes = questionRows.map((row) => ({
        ID: String(row.ID),
        ORDEM: Number(row.ORDEM),
        ENUNCIADO: String(row.ENUNCIADO),
        PESO: Number(row.PESO),
        OPCOES: [],
    }));
    if (questoes.length > 0) {
        const opcoesResult = await pool
            .request()
            .input("PROVA_ID", db_1.sql.UniqueIdentifier, provaId)
            .input("VERSAO", db_1.sql.Int, versao)
            .query(`
        SELECT o.ID, o.QUESTAO_ID, o.ORDEM, o.TEXTO, o.CORRETA
        FROM dbo.TPROVA_OPCOES o
        JOIN dbo.TPROVA_QUESTOES q ON q.ID = o.QUESTAO_ID
        WHERE q.PROVA_ID = @PROVA_ID
          AND q.VERSAO = @VERSAO
        ORDER BY q.ORDEM, o.ORDEM
      `);
        const optionRows = opcoesResult.recordset;
        const questionMap = new Map(questoes.map((questao) => [questao.ID, questao]));
        for (const row of optionRows) {
            const question = questionMap.get(String(row.QUESTAO_ID));
            if (!question)
                continue;
            question.OPCOES.push({
                ID: String(row.ID),
                ORDEM: Number(row.ORDEM),
                TEXTO: String(row.TEXTO),
                CORRETA: Boolean(row.CORRETA),
            });
        }
    }
    return {
        ...prova,
        MODO_APLICACAO: normalizeProvaModoAplicacao(prova.MODO_APLICACAO),
        QUESTOES: questoes,
    };
}
async function getStructuredProvaByTrilhaId(trilhaId, proofPath, versao) {
    const prova = await getProvaByTrilhaId(trilhaId, proofPath);
    if (!prova) {
        return undefined;
    }
    const targetVersion = versao ?? prova.VERSAO;
    return fetchObjectiveProvaByVersion(prova.ID, targetVersion);
}
async function getObjectiveProvaByTrilhaId(trilhaId, versao) {
    return getStructuredProvaByTrilhaId(trilhaId, exports.OBJECTIVE_PLACEHOLDER_PATH, versao);
}
async function getEfficacyProvaByTrilhaId(trilhaId, versao) {
    return getStructuredProvaByTrilhaId(trilhaId, exports.EFFICACY_PLACEHOLDER_PATH, versao);
}
async function getObjectiveProvaForExecutionByTrilhaId(trilhaId) {
    const prova = await getObjectiveProvaByTrilhaId(trilhaId);
    if (!prova) {
        return undefined;
    }
    const procedimentoQuestoes = await (0, procedimentoProvaModel_1.listLatestProcedimentoProvaQuestoesByTrilha)(trilhaId);
    if (!procedimentoQuestoes.length) {
        return prova;
    }
    const baseOrder = prova.QUESTOES.length;
    const mergedQuestions = [
        ...prova.QUESTOES.map((question) => ({ ...question })),
        ...procedimentoQuestoes.map((question, index) => ({
            ID: question.ID,
            ORDEM: baseOrder + index + 1,
            ENUNCIADO: question.ENUNCIADO,
            PESO: question.PESO,
            OPCOES: question.OPCOES.map((option) => ({
                ID: option.ID,
                ORDEM: option.ORDEM,
                TEXTO: option.TEXTO,
                CORRETA: option.CORRETA,
            })),
        })),
    ];
    return {
        ...prova,
        MODO_APLICACAO: exports.PROVA_MODO_APLICACAO.COLETIVA,
        NOTA_TOTAL: 10,
        QUESTOES: normalizeObjectiveQuestionWeights(mergedQuestions),
    };
}
async function proofExecutionMustBeCollective(trilhaId) {
    return (0, procedimentoProvaModel_1.trilhaHasMaterialVinculadoAProcedimento)(trilhaId);
}
async function trilhaHasObjectiveProva(trilhaId) {
    const prova = await getProvaByTrilhaId(trilhaId, exports.OBJECTIVE_PLACEHOLDER_PATH);
    if (!prova)
        return false;
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("PROVA_ID", db_1.sql.UniqueIdentifier, prova.ID)
        .input("VERSAO", db_1.sql.Int, prova.VERSAO)
        .query(`
      SELECT COUNT(1) AS TOTAL
      FROM dbo.TPROVA_QUESTOES
      WHERE PROVA_ID = @PROVA_ID
        AND VERSAO = @VERSAO
    `);
    return Number(result.recordset[0]?.TOTAL ?? 0) > 0;
}
async function createOrVersionStructuredProva(input) {
    await ensureProvaSchemaSupportsMultipleProofTypes();
    const pool = await (0, db_1.getPool)();
    const transaction = new db_1.sql.Transaction(pool);
    await transaction.begin();
    try {
        const request = new db_1.sql.Request(transaction);
        const currentResult = await request
            .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, input.trilhaId)
            .input("PROVA_PATH", db_1.sql.NVarChar(1000), input.proofPath)
            .query(`
        SELECT TOP 1 ID, VERSAO
        FROM dbo.TPROVAS
        WHERE TRILHA_FK_ID = @TRILHA_FK_ID
          AND PROVA_PATH = @PROVA_PATH
        ORDER BY VERSAO DESC
      `);
        const current = currentResult.recordset[0];
        const provaId = current?.ID ?? (0, crypto_1.randomUUID)();
        const nextVersion = (current?.VERSAO ?? 0) + 1;
        if (!current) {
            await new db_1.sql.Request(transaction)
                .input("ID", db_1.sql.UniqueIdentifier, provaId)
                .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, input.trilhaId)
                .input("PROVA_PATH", db_1.sql.NVarChar(1000), input.proofPath)
                .input("VERSAO", db_1.sql.Int, nextVersion)
                .input("MODO_APLICACAO", db_1.sql.VarChar(20), normalizeProvaModoAplicacao(input.modoAplicacao))
                .input("TITULO", db_1.sql.NVarChar(255), input.titulo)
                .input("NOTA_TOTAL", db_1.sql.Decimal(5, 2), input.notaTotal)
                .input("ATUALIZADO_EM", db_1.sql.DateTime2, new Date())
                .query(`
          INSERT INTO dbo.TPROVAS (ID, TRILHA_FK_ID, PROVA_PATH, VERSAO, MODO_APLICACAO, TITULO, NOTA_TOTAL, ATUALIZADO_EM)
          VALUES (@ID, @TRILHA_FK_ID, @PROVA_PATH, @VERSAO, @MODO_APLICACAO, @TITULO, @NOTA_TOTAL, @ATUALIZADO_EM)
        `);
        }
        else {
            await new db_1.sql.Request(transaction)
                .input("ID", db_1.sql.UniqueIdentifier, provaId)
                .input("PROVA_PATH", db_1.sql.NVarChar(1000), input.proofPath)
                .input("VERSAO", db_1.sql.Int, nextVersion)
                .input("MODO_APLICACAO", db_1.sql.VarChar(20), normalizeProvaModoAplicacao(input.modoAplicacao))
                .input("TITULO", db_1.sql.NVarChar(255), input.titulo)
                .input("NOTA_TOTAL", db_1.sql.Decimal(5, 2), input.notaTotal)
                .input("ATUALIZADO_EM", db_1.sql.DateTime2, new Date())
                .query(`
          UPDATE dbo.TPROVAS
          SET VERSAO = @VERSAO,
              PROVA_PATH = @PROVA_PATH,
              MODO_APLICACAO = @MODO_APLICACAO,
              TITULO = @TITULO,
              NOTA_TOTAL = @NOTA_TOTAL,
              ATUALIZADO_EM = @ATUALIZADO_EM
          WHERE ID = @ID
        `);
        }
        for (let qIndex = 0; qIndex < input.questoes.length; qIndex += 1) {
            const questao = input.questoes[qIndex];
            const questaoId = (0, crypto_1.randomUUID)();
            await new db_1.sql.Request(transaction)
                .input("ID", db_1.sql.UniqueIdentifier, questaoId)
                .input("PROVA_ID", db_1.sql.UniqueIdentifier, provaId)
                .input("VERSAO", db_1.sql.Int, nextVersion)
                .input("ORDEM", db_1.sql.Int, qIndex + 1)
                .input("ENUNCIADO", db_1.sql.NVarChar(2000), questao.enunciado)
                .input("PESO", db_1.sql.Decimal(5, 2), questao.peso)
                .query(`
          INSERT INTO dbo.TPROVA_QUESTOES (ID, PROVA_ID, VERSAO, ORDEM, ENUNCIADO, PESO)
          VALUES (@ID, @PROVA_ID, @VERSAO, @ORDEM, @ENUNCIADO, @PESO)
        `);
            for (let oIndex = 0; oIndex < questao.opcoes.length; oIndex += 1) {
                const opcao = questao.opcoes[oIndex];
                await new db_1.sql.Request(transaction)
                    .input("ID", db_1.sql.UniqueIdentifier, (0, crypto_1.randomUUID)())
                    .input("QUESTAO_ID", db_1.sql.UniqueIdentifier, questaoId)
                    .input("ORDEM", db_1.sql.Int, oIndex + 1)
                    .input("TEXTO", db_1.sql.NVarChar(1000), opcao.texto)
                    .input("CORRETA", db_1.sql.Bit, opcao.correta ? 1 : 0)
                    .query(`
            INSERT INTO dbo.TPROVA_OPCOES (ID, QUESTAO_ID, ORDEM, TEXTO, CORRETA)
            VALUES (@ID, @QUESTAO_ID, @ORDEM, @TEXTO, @CORRETA)
          `);
            }
        }
        await transaction.commit();
        return fetchObjectiveProvaByVersion(provaId, nextVersion);
    }
    catch (error) {
        await transaction.rollback();
        throw error;
    }
}
async function createOrVersionObjectiveProva(input) {
    return createOrVersionStructuredProva({
        ...input,
        proofPath: exports.OBJECTIVE_PLACEHOLDER_PATH,
    });
}
async function createOrVersionEfficacyProva(input) {
    return createOrVersionStructuredProva({
        ...input,
        proofPath: exports.EFFICACY_PLACEHOLDER_PATH,
    });
}
