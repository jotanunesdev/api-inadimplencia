"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrilhaColumnState = getTrilhaColumnState;
exports.listTrilhasByModulo = listTrilhasByModulo;
exports.listTrilhasByUser = listTrilhasByUser;
exports.getTrilhaById = getTrilhaById;
exports.trilhaHasStructuredEfficacyConfig = trilhaHasStructuredEfficacyConfig;
exports.trilhaHasEficaciaConfig = trilhaHasEficaciaConfig;
exports.listPendingRhEfficacyTrilhas = listPendingRhEfficacyTrilhas;
exports.upsertTrilhaEficaciaConfig = upsertTrilhaEficaciaConfig;
exports.clearTrilhaEficaciaConfig = clearTrilhaEficaciaConfig;
exports.createTrilha = createTrilha;
exports.updateTrilha = updateTrilha;
exports.deleteTrilha = deleteTrilha;
const db_1 = require("../config/db");
const trilhaShareModel_1 = require("./trilhaShareModel");
const provaModel_1 = require("./provaModel");
const sectorAccess_1 = require("../utils/sectorAccess");
async function getTrilhaColumnState() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.TTRILHAS', 'DESCRICAO') AS DESCRICAO_COL,
      COL_LENGTH('dbo.TTRILHAS', 'EIXO') AS EIXO_COL,
      COL_LENGTH('dbo.TTRILHAS', 'PROCEDIMENTO_ID') AS PROCEDIMENTO_ID_COL,
      COL_LENGTH('dbo.TTRILHAS', 'NORMA_ID') AS NORMA_ID_COL,
      COL_LENGTH('dbo.TTRILHAS', 'AVALIACAO_EFICACIA_OBRIGATORIA') AS OBRIGATORIA_COL,
      COL_LENGTH('dbo.TTRILHAS', 'AVALIACAO_EFICACIA_PERGUNTA') AS PERGUNTA_COL,
      COL_LENGTH('dbo.TTRILHAS', 'AVALIACAO_EFICACIA_ATUALIZADA_EM') AS ATUALIZADA_EM_COL
  `);
    const row = result.recordset[0];
    return {
        hasDescricao: Boolean(row?.DESCRICAO_COL),
        hasEficaciaAtualizadaEm: Boolean(row?.ATUALIZADA_EM_COL),
        hasEficaciaObrigatoria: Boolean(row?.OBRIGATORIA_COL),
        hasEficaciaPergunta: Boolean(row?.PERGUNTA_COL),
        hasEixo: Boolean(row?.EIXO_COL),
        hasNormaId: Boolean(row?.NORMA_ID_COL),
        hasProcedimentoId: Boolean(row?.PROCEDIMENTO_ID_COL),
    };
}
async function ensureTrilhaEficaciaColumns() {
    const columnState = await getTrilhaColumnState();
    if (!columnState.hasEficaciaObrigatoria ||
        !columnState.hasEficaciaPergunta ||
        !columnState.hasEficaciaAtualizadaEm) {
        const error = new Error("Colunas de avaliacao de eficacia da trilha ausentes");
        error.code = "TRILHA_EFICACIA_CONFIG_COLUMNS_MISSING";
        throw error;
    }
}
function buildTrilhaSelectFragment(columnState) {
    const fragments = ["t.*"];
    if (!columnState.hasDescricao) {
        fragments.push("CAST(NULL AS NVARCHAR(MAX)) AS DESCRICAO");
    }
    if (!columnState.hasEixo) {
        fragments.push("CAST(NULL AS NVARCHAR(255)) AS EIXO");
    }
    if (!columnState.hasProcedimentoId) {
        fragments.push("CAST(NULL AS UNIQUEIDENTIFIER) AS PROCEDIMENTO_ID");
    }
    if (!columnState.hasNormaId) {
        fragments.push("CAST(NULL AS UNIQUEIDENTIFIER) AS NORMA_ID");
    }
    return fragments.join(", ");
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
`;
const TRILHA_ASSIGNMENT_COUNT_JOIN = `
  LEFT JOIN (
    SELECT ut.TRILHA_ID, COUNT(DISTINCT ut.USUARIO_CPF) AS TOTAL_ATRIBUIDOS
    FROM dbo.TUSUARIO_TRILHAS ut
    GROUP BY ut.TRILHA_ID
  ) a ON a.TRILHA_ID = t.ID
`;
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
`;
async function listTrilhasByModulo(moduloId) {
    const columnState = await getTrilhaColumnState();
    const hasShareTable = await (0, trilhaShareModel_1.hasTrilhaShareTable)();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("MODULO_FK_ID", db_1.sql.UniqueIdentifier, moduloId)
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
    `);
    return result.recordset;
}
async function listTrilhasByUser(cpf, moduloId) {
    const columnState = await getTrilhaColumnState();
    const pool = await (0, db_1.getPool)();
    const request = pool.request().input("USUARIO_CPF", db_1.sql.VarChar(100), cpf);
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
  `;
    if (moduloId) {
        request.input("MODULO_FK_ID", db_1.sql.UniqueIdentifier, moduloId);
        query += " AND t.MODULO_FK_ID = @MODULO_FK_ID";
    }
    const result = await request.query(query);
    return result.recordset;
}
async function getTrilhaById(id) {
    const columnState = await getTrilhaColumnState();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query(`
      SELECT ${buildTrilhaSelectFragment(columnState)},
        m.NOME AS MODULO_NOME,
        COALESCE(a.TOTAL_ATRIBUIDOS, 0) AS TOTAL_ATRIBUIDOS,
        COALESCE(c.TOTAL_CONCLUIDOS, 0) AS TOTAL_CONCLUIDOS
      FROM dbo.TTRILHAS t
      LEFT JOIN dbo.TMODULOS m ON m.ID = t.MODULO_FK_ID
      ${TRILHA_ASSIGNMENT_COUNT_JOIN}
      ${TRILHA_COMPLETION_COUNT_JOIN}
      WHERE t.ID = @ID
    `);
    return result.recordset[0];
}
async function trilhaHasStructuredEfficacyConfig(trilhaId) {
    const prova = await (0, provaModel_1.getEfficacyProvaByTrilhaId)(trilhaId);
    return Boolean(prova?.QUESTOES?.length);
}
async function trilhaHasEficaciaConfig(trilhaId) {
    if (await trilhaHasStructuredEfficacyConfig(trilhaId)) {
        return true;
    }
    await ensureTrilhaEficaciaColumns();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, trilhaId)
        .query(`
      SELECT TOP 1
        CASE
          WHEN NULLIF(LTRIM(RTRIM(ISNULL(AVALIACAO_EFICACIA_PERGUNTA, ''))), '') IS NOT NULL
          THEN CAST(1 AS BIT)
          ELSE CAST(0 AS BIT)
        END AS POSSUI
      FROM dbo.TTRILHAS
      WHERE ID = @ID
    `);
    const row = result.recordset[0];
    if (!row)
        return false;
    return row.POSSUI === true || Number(row.POSSUI ?? 0) === 1;
}
async function listPendingRhEfficacyTrilhas() {
    const columnState = await getTrilhaColumnState();
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
      SELECT ${buildTrilhaSelectFragment(columnState)},
        COALESCE(a.TOTAL_ATRIBUIDOS, 0) AS TOTAL_ATRIBUIDOS,
        COALESCE(c.TOTAL_CONCLUIDOS, 0) AS TOTAL_CONCLUIDOS,
        m.NOME AS MODULO_NOME
      FROM dbo.TTRILHAS t
      INNER JOIN dbo.TMODULOS m
        ON m.ID = t.MODULO_FK_ID
      ${TRILHA_ASSIGNMENT_COUNT_JOIN}
      ${TRILHA_COMPLETION_COUNT_JOIN}
      WHERE EXISTS (
        SELECT 1
        FROM dbo.TPROVAS objective_prova
        WHERE objective_prova.TRILHA_FK_ID = t.ID
          AND objective_prova.PROVA_PATH = '${provaModel_1.OBJECTIVE_PLACEHOLDER_PATH}'
      )
      ORDER BY COALESCE(t.ATUALIZADO_EM, SYSUTCDATETIME()) DESC, t.TITULO
    `);
    const records = result.recordset;
    const filtered = await Promise.all(records.map(async (trilha) => {
        const ownerSector = (0, sectorAccess_1.resolveSectorDefinitionFromModuleName)(trilha.MODULO_NOME);
        if (!ownerSector || ownerSector.key === "recursos-humanos") {
            return null;
        }
        const hasConfig = await trilhaHasEficaciaConfig(trilha.ID).catch(() => false);
        return hasConfig ? null : trilha;
    }));
    return filtered.filter((trilha) => Boolean(trilha));
}
async function upsertTrilhaEficaciaConfig(trilhaId, input) {
    await ensureTrilhaEficaciaColumns();
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, trilhaId)
        .input("AVALIACAO_EFICACIA_OBRIGATORIA", db_1.sql.Bit, input.obrigatoria === false ? false : true)
        .input("AVALIACAO_EFICACIA_PERGUNTA", db_1.sql.NVarChar(db_1.sql.MAX), input.pergunta)
        .input("AVALIACAO_EFICACIA_ATUALIZADA_EM", db_1.sql.DateTime2, input.atualizadoEm ?? new Date())
        .query(`
      UPDATE dbo.TTRILHAS
      SET
        AVALIACAO_EFICACIA_OBRIGATORIA = @AVALIACAO_EFICACIA_OBRIGATORIA,
        AVALIACAO_EFICACIA_PERGUNTA = @AVALIACAO_EFICACIA_PERGUNTA,
        AVALIACAO_EFICACIA_ATUALIZADA_EM = @AVALIACAO_EFICACIA_ATUALIZADA_EM
      WHERE ID = @ID
    `);
    return getTrilhaById(trilhaId);
}
async function clearTrilhaEficaciaConfig(trilhaId) {
    await ensureTrilhaEficaciaColumns();
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, trilhaId)
        .query(`
      UPDATE dbo.TTRILHAS
      SET
        AVALIACAO_EFICACIA_OBRIGATORIA = 0,
        AVALIACAO_EFICACIA_PERGUNTA = NULL,
        AVALIACAO_EFICACIA_ATUALIZADA_EM = SYSUTCDATETIME()
      WHERE ID = @ID
    `);
    return getTrilhaById(trilhaId);
}
async function createTrilha(input) {
    const columnState = await getTrilhaColumnState();
    const pool = await (0, db_1.getPool)();
    const request = pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.id)
        .input("MODULO_FK_ID", db_1.sql.UniqueIdentifier, input.moduloId)
        .input("TITULO", db_1.sql.NVarChar(255), input.titulo)
        .input("CRIADO_POR", db_1.sql.NVarChar(255), input.criadoPor ?? null)
        .input("ATUALIZADO_EM", db_1.sql.DateTime2, input.atualizadoEm ?? null)
        .input("PATH", db_1.sql.NVarChar(500), input.path ?? null);
    if (columnState.hasDescricao) {
        request.input("DESCRICAO", db_1.sql.NVarChar(db_1.sql.MAX), input.descricao ?? null);
    }
    if (columnState.hasEixo) {
        request.input("EIXO", db_1.sql.NVarChar(255), input.eixo ?? null);
    }
    if (columnState.hasProcedimentoId) {
        request.input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, input.procedimentoId ?? null);
    }
    if (columnState.hasNormaId) {
        request.input("NORMA_ID", db_1.sql.UniqueIdentifier, input.normaId ?? null);
    }
    await request.query(`
      INSERT INTO dbo.TTRILHAS (
        ID,
        MODULO_FK_ID,
        TITULO,
        CRIADO_POR,
        ${columnState.hasDescricao ? "DESCRICAO," : ""}
        ${columnState.hasEixo ? "EIXO," : ""}
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
        ${columnState.hasEixo ? "@EIXO," : ""}
        ${columnState.hasProcedimentoId ? "@PROCEDIMENTO_ID," : ""}
        ${columnState.hasNormaId ? "@NORMA_ID," : ""}
        @ATUALIZADO_EM,
        @PATH
      )
    `);
    return getTrilhaById(input.id);
}
async function updateTrilha(id, input) {
    const columnState = await getTrilhaColumnState();
    const pool = await (0, db_1.getPool)();
    const request = pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("MODULO_FK_ID", db_1.sql.UniqueIdentifier, input.moduloId ?? null)
        .input("TITULO", db_1.sql.NVarChar(255), input.titulo ?? null)
        .input("CRIADO_POR", db_1.sql.NVarChar(255), input.criadoPor ?? null)
        .input("ATUALIZADO_EM", db_1.sql.DateTime2, input.atualizadoEm ?? null)
        .input("PATH", db_1.sql.NVarChar(500), input.path ?? null);
    if (columnState.hasDescricao) {
        request.input("HAS_DESCRICAO", db_1.sql.Bit, input.descricao !== undefined);
        request.input("DESCRICAO", db_1.sql.NVarChar(db_1.sql.MAX), input.descricao ?? null);
    }
    if (columnState.hasEixo) {
        request.input("HAS_EIXO", db_1.sql.Bit, input.eixo !== undefined);
        request.input("EIXO", db_1.sql.NVarChar(255), input.eixo ?? null);
    }
    if (columnState.hasProcedimentoId) {
        request.input("HAS_PROCEDIMENTO_ID", db_1.sql.Bit, input.procedimentoId !== undefined);
        request.input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, input.procedimentoId ?? null);
    }
    if (columnState.hasNormaId) {
        request.input("HAS_NORMA_ID", db_1.sql.Bit, input.normaId !== undefined);
        request.input("NORMA_ID", db_1.sql.UniqueIdentifier, input.normaId ?? null);
    }
    await request.query(`
      UPDATE dbo.TTRILHAS
      SET
        MODULO_FK_ID = COALESCE(@MODULO_FK_ID, MODULO_FK_ID),
        TITULO = COALESCE(@TITULO, TITULO),
        CRIADO_POR = COALESCE(@CRIADO_POR, CRIADO_POR),
        ${columnState.hasDescricao ? "DESCRICAO = CASE WHEN @HAS_DESCRICAO = 1 THEN @DESCRICAO ELSE DESCRICAO END," : ""}
        ${columnState.hasEixo ? "EIXO = CASE WHEN @HAS_EIXO = 1 THEN @EIXO ELSE EIXO END," : ""}
        ${columnState.hasProcedimentoId ? "PROCEDIMENTO_ID = CASE WHEN @HAS_PROCEDIMENTO_ID = 1 THEN @PROCEDIMENTO_ID ELSE PROCEDIMENTO_ID END," : ""}
        ${columnState.hasNormaId ? "NORMA_ID = CASE WHEN @HAS_NORMA_ID = 1 THEN @NORMA_ID ELSE NORMA_ID END," : ""}
        ATUALIZADO_EM = COALESCE(@ATUALIZADO_EM, ATUALIZADO_EM),
        PATH = COALESCE(@PATH, PATH)
      WHERE ID = @ID
    `);
    return getTrilhaById(id);
}
async function deleteTrilha(id) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("DELETE FROM dbo.TTRILHAS WHERE ID = @ID");
}
