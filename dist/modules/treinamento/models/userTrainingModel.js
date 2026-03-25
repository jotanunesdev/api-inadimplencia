"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveExpiredNormaTrainings = archiveExpiredNormaTrainings;
exports.recordUserTraining = recordUserTraining;
exports.recordUserTrainings = recordUserTrainings;
exports.attachFaceEvidenceToTurmaTrainings = attachFaceEvidenceToTurmaTrainings;
exports.recordTrainingEficaciaByTrilha = recordTrainingEficaciaByTrilha;
exports.recordTrainingEficaciaByTurma = recordTrainingEficaciaByTurma;
exports.getTrainingEficaciaSummary = getTrainingEficaciaSummary;
exports.getIndividualTrainingHoursMonthlySummaryLast12Months = getIndividualTrainingHoursMonthlySummaryLast12Months;
exports.isVideoAssignedToUser = isVideoAssignedToUser;
exports.listUserVideoCompletions = listUserVideoCompletions;
exports.listVideoCompletionsByMaterial = listVideoCompletionsByMaterial;
exports.listCompletionReport = listCompletionReport;
exports.listArchivedCompletionReport = listArchivedCompletionReport;
exports.archiveVideoCompletionsByVideoId = archiveVideoCompletionsByVideoId;
exports.archiveTrainingProgressByTrilhaIds = archiveTrainingProgressByTrilhaIds;
exports.archiveTrainingsByProcedimentoId = archiveTrainingsByProcedimentoId;
exports.archiveTrainingsByNormaId = archiveTrainingsByNormaId;
exports.getUserCurrentVideoProgressByTrilha = getUserCurrentVideoProgressByTrilha;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const trilhaModel_1 = require("./trilhaModel");
async function archiveExpiredNormaTrainings(archivedAt = new Date(), filters) {
    const pool = await (0, db_1.getPool)();
    const trilhaColumnState = await (0, trilhaModel_1.getTrilhaColumnState)();
    const validityColumns = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.TNORMAS', 'VALIDADE_MESES') AS HAS_VALIDADE_MESES,
      COL_LENGTH('dbo.TNORMAS', 'VALIDADE_ANOS') AS HAS_VALIDADE_ANOS
  `);
    const hasMeses = Boolean(validityColumns.recordset[0]?.HAS_VALIDADE_MESES);
    const hasAnos = Boolean(validityColumns.recordset[0]?.HAS_VALIDADE_ANOS);
    if (!hasMeses || !hasAnos) {
        return 0;
    }
    const result = await pool
        .request()
        .input("ARQUIVADO_EM", db_1.sql.DateTime2, archivedAt)
        .input("FILTER_CPF", db_1.sql.VarChar(100), filters?.cpf ?? null)
        .input("FILTER_TIPO", db_1.sql.VarChar(20), filters?.tipo ?? null)
        .input("FILTER_MATERIAL_ID", db_1.sql.UniqueIdentifier, filters?.materialId ?? null)
        .query(`
      ;WITH NORMA_LATEST AS (
        SELECT
          n.ID,
          (ISNULL(n.VALIDADE_ANOS, 0) * 12) + ISNULL(n.VALIDADE_MESES, 0) AS VALIDADE_TOTAL_MESES
        FROM (
          SELECT
            ID,
            VALIDADE_MESES,
            VALIDADE_ANOS,
            ROW_NUMBER() OVER (PARTITION BY ID ORDER BY VERSAO DESC) AS RN
          FROM dbo.TNORMAS
        ) n
        WHERE n.RN = 1
      )
      UPDATE ut
      SET ut.ARQUIVADO_EM = @ARQUIVADO_EM
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      OUTER APPLY (
        SELECT TOP 1 vv.NORMA_ID
        FROM dbo.TVIDEOS vv
        WHERE ut.TIPO = 'video'
          AND vv.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND vv.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE
            WHEN ut.MATERIAL_VERSAO IS NOT NULL AND vv.VERSAO = ut.MATERIAL_VERSAO THEN 0
            ELSE 1
          END,
          vv.VERSAO DESC
      ) video_ref
      OUTER APPLY (
        SELECT TOP 1 pp.NORMA_ID
        FROM dbo.TPDFS pp
        WHERE ut.TIPO = 'pdf'
          AND pp.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND pp.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE
            WHEN ut.MATERIAL_VERSAO IS NOT NULL AND pp.VERSAO = ut.MATERIAL_VERSAO THEN 0
            ELSE 1
          END,
          pp.VERSAO DESC
      ) pdf_ref
      OUTER APPLY (
        SELECT TOP 1
          ${trilhaColumnState.hasNormaId ? "tr_rel.NORMA_ID" : "CAST(NULL AS UNIQUEIDENTIFIER)"} AS NORMA_ID
        FROM dbo.TPROVAS pr
        JOIN dbo.TTRILHAS tr_rel ON tr_rel.ID = pr.TRILHA_FK_ID
        WHERE ut.TIPO = 'prova'
          AND pr.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND pr.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE
            WHEN ut.MATERIAL_VERSAO IS NOT NULL AND pr.VERSAO = ut.MATERIAL_VERSAO THEN 0
            ELSE 1
          END,
          pr.VERSAO DESC
      ) prova_ref
      LEFT JOIN NORMA_LATEST norma
        ON norma.ID = COALESCE(video_ref.NORMA_ID, pdf_ref.NORMA_ID, prova_ref.NORMA_ID)
      WHERE ut.ARQUIVADO_EM IS NULL
        AND ut.TIPO IN ('video', 'pdf', 'prova')
        AND (@FILTER_CPF IS NULL OR ut.USUARIO_CPF = @FILTER_CPF)
        AND (@FILTER_TIPO IS NULL OR ut.TIPO = @FILTER_TIPO)
        AND (@FILTER_MATERIAL_ID IS NULL OR ut.MATERIAL_ID = @FILTER_MATERIAL_ID)
        AND norma.ID IS NOT NULL
        AND norma.VALIDADE_TOTAL_MESES > 0
        AND DATEADD(MONTH, norma.VALIDADE_TOTAL_MESES, ut.DT_CONCLUSAO) < SYSUTCDATETIME()
    `);
    return result.rowsAffected[0] ?? 0;
}
async function recordUserTraining(input, options) {
    if (!options?.skipExpiryArchive) {
        await archiveExpiredNormaTrainings(new Date(), {
            cpf: input.cpf,
            tipo: input.tipo,
            materialId: input.materialId,
        });
    }
    const pool = await (0, db_1.getPool)();
    const params = {
        id: (0, crypto_1.randomUUID)(),
        cpf: input.cpf,
        tipo: input.tipo,
        materialId: input.materialId,
        materialVersao: input.materialVersao ?? null,
        turmaId: input.turmaId ?? null,
        concluidoEm: input.concluidoEm ?? new Date(),
        origem: input.origem ?? null,
    };
    const executeUpsert = async () => pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, params.id)
        .input("USUARIO_CPF", db_1.sql.VarChar(100), params.cpf)
        .input("TIPO", db_1.sql.VarChar(20), params.tipo)
        .input("MATERIAL_ID", db_1.sql.UniqueIdentifier, params.materialId)
        .input("MATERIAL_VERSAO", db_1.sql.Int, params.materialVersao)
        .input("TURMA_ID", db_1.sql.UniqueIdentifier, params.turmaId)
        .input("DT_CONCLUSAO", db_1.sql.DateTime2, params.concluidoEm)
        .input("ORIGEM", db_1.sql.VarChar(50), params.origem)
        .query(`
      ;WITH EXISTENTE AS (
        SELECT TOP 1 ut.ID
        FROM dbo.TUSUARIO_TREINAMENTOS ut WITH (UPDLOCK, HOLDLOCK)
        WHERE ut.USUARIO_CPF = @USUARIO_CPF
          AND ut.TIPO = @TIPO
          AND ut.MATERIAL_ID = @MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NULL AND @MATERIAL_VERSAO IS NULL)
            OR ut.MATERIAL_VERSAO = @MATERIAL_VERSAO
          )
        ORDER BY
          CASE WHEN ut.ARQUIVADO_EM IS NULL THEN 0 ELSE 1 END,
          ut.DT_CONCLUSAO DESC
      )
      UPDATE ut
      SET
        ut.TURMA_ID = COALESCE(@TURMA_ID, ut.TURMA_ID),
        ut.DT_CONCLUSAO = @DT_CONCLUSAO,
        ut.ORIGEM = COALESCE(@ORIGEM, ut.ORIGEM),
        ut.ARQUIVADO_EM = NULL
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      JOIN EXISTENTE e ON e.ID = ut.ID;

      IF @@ROWCOUNT = 0
      BEGIN
        INSERT INTO dbo.TUSUARIO_TREINAMENTOS (
          ID,
          USUARIO_CPF,
          TIPO,
          MATERIAL_ID,
          MATERIAL_VERSAO,
          TURMA_ID,
          DT_CONCLUSAO,
          ORIGEM
        )
        VALUES (
          @ID,
          @USUARIO_CPF,
          @TIPO,
          @MATERIAL_ID,
          @MATERIAL_VERSAO,
          @TURMA_ID,
          @DT_CONCLUSAO,
          @ORIGEM
        );
      END
    `);
    try {
        const result = await executeUpsert();
        return result.rowsAffected.some((value) => value > 0);
    }
    catch (error) {
        const requestError = error;
        const number = requestError.number ?? requestError.originalError?.number;
        if (number === 2601 || number === 2627) {
            const fallback = await pool
                .request()
                .input("USUARIO_CPF", db_1.sql.VarChar(100), params.cpf)
                .input("TIPO", db_1.sql.VarChar(20), params.tipo)
                .input("MATERIAL_ID", db_1.sql.UniqueIdentifier, params.materialId)
                .input("MATERIAL_VERSAO", db_1.sql.Int, params.materialVersao)
                .input("TURMA_ID", db_1.sql.UniqueIdentifier, params.turmaId)
                .input("DT_CONCLUSAO", db_1.sql.DateTime2, params.concluidoEm)
                .input("ORIGEM", db_1.sql.VarChar(50), params.origem)
                .query(`
          UPDATE ut
          SET
            ut.TURMA_ID = COALESCE(@TURMA_ID, ut.TURMA_ID),
            ut.DT_CONCLUSAO = @DT_CONCLUSAO,
            ut.ORIGEM = COALESCE(@ORIGEM, ut.ORIGEM),
            ut.ARQUIVADO_EM = NULL
          FROM dbo.TUSUARIO_TREINAMENTOS ut
          WHERE ut.USUARIO_CPF = @USUARIO_CPF
            AND ut.TIPO = @TIPO
            AND ut.MATERIAL_ID = @MATERIAL_ID
            AND (
              (ut.MATERIAL_VERSAO IS NULL AND @MATERIAL_VERSAO IS NULL)
              OR ut.MATERIAL_VERSAO = @MATERIAL_VERSAO
            )
        `);
            return fallback.rowsAffected.some((value) => value > 0);
        }
        throw error;
    }
}
async function recordUserTrainings(inputs) {
    await archiveExpiredNormaTrainings();
    let inserted = 0;
    for (const input of inputs) {
        // eslint-disable-next-line no-await-in-loop
        const didInsert = await recordUserTraining(input, { skipExpiryArchive: true });
        if (didInsert)
            inserted += 1;
    }
    return { inserted };
}
async function attachFaceEvidenceToTurmaTrainings(input) {
    const pool = await (0, db_1.getPool)();
    const colsResult = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.TUSUARIO_TREINAMENTOS', 'FACE_CONFIRMACAO_FOTO_BASE64') AS HAS_FACE_BASE64,
      COL_LENGTH('dbo.TUSUARIO_TREINAMENTOS', 'FACE_CONFIRMACAO_FOTO_URL') AS HAS_FACE_URL,
      COL_LENGTH('dbo.TUSUARIO_TREINAMENTOS', 'FACE_CONFIRMACAO_EM') AS HAS_FACE_AT
  `);
    const hasFaceBase64 = Boolean(colsResult.recordset[0]?.HAS_FACE_BASE64);
    const hasFaceUrl = Boolean(colsResult.recordset[0]?.HAS_FACE_URL);
    const hasFaceAt = Boolean(colsResult.recordset[0]?.HAS_FACE_AT);
    if (!hasFaceBase64 || !hasFaceUrl || !hasFaceAt) {
        const error = new Error("USER_TRAINING_FACE_EVIDENCE_COLUMNS_MISSING");
        error.code = "USER_TRAINING_FACE_EVIDENCE_COLUMNS_MISSING";
        throw error;
    }
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), input.cpf)
        .input("TURMA_ID", db_1.sql.UniqueIdentifier, input.turmaId)
        .input("FACE_CONFIRMACAO_FOTO_BASE64", db_1.sql.NVarChar(db_1.sql.MAX), input.fotoConfirmacaoBase64 ?? null)
        .input("FACE_CONFIRMACAO_FOTO_URL", db_1.sql.NVarChar(2000), input.fotoConfirmacaoUrl ?? null)
        .input("FACE_CONFIRMACAO_EM", db_1.sql.DateTime2, input.confirmadoEm ?? new Date())
        .query(`
      UPDATE ut
      SET
        ut.FACE_CONFIRMACAO_FOTO_BASE64 = COALESCE(@FACE_CONFIRMACAO_FOTO_BASE64, ut.FACE_CONFIRMACAO_FOTO_BASE64),
        ut.FACE_CONFIRMACAO_FOTO_URL = COALESCE(@FACE_CONFIRMACAO_FOTO_URL, ut.FACE_CONFIRMACAO_FOTO_URL),
        ut.FACE_CONFIRMACAO_EM = @FACE_CONFIRMACAO_EM
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      WHERE ut.USUARIO_CPF = @USUARIO_CPF
        AND ut.TURMA_ID = @TURMA_ID
        AND ut.ARQUIVADO_EM IS NULL
        AND ut.TIPO IN ('video', 'pdf', 'prova')
    `);
    return result.rowsAffected[0] ?? 0;
}
async function ensureUserTrainingEficaciaColumns() {
    const pool = await (0, db_1.getPool)();
    const colsResult = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.TUSUARIO_TREINAMENTOS', 'AVALIACAO_EFICACIA_NIVEL') AS HAS_EFICACIA_NIVEL,
      COL_LENGTH('dbo.TUSUARIO_TREINAMENTOS', 'AVALIACAO_EFICACIA_EM') AS HAS_EFICACIA_EM
  `);
    const hasNivel = Boolean(colsResult.recordset[0]?.HAS_EFICACIA_NIVEL);
    const hasAt = Boolean(colsResult.recordset[0]?.HAS_EFICACIA_EM);
    if (!hasNivel || !hasAt) {
        const error = new Error("USER_TRAINING_EFICACY_COLUMNS_MISSING");
        error.code = "USER_TRAINING_EFICACY_COLUMNS_MISSING";
        throw error;
    }
}
async function recordTrainingEficaciaByTrilha(input) {
    await ensureUserTrainingEficaciaColumns();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), input.cpf)
        .input("TRILHA_ID", db_1.sql.UniqueIdentifier, input.trilhaId)
        .input("AVALIACAO_EFICACIA_NIVEL", db_1.sql.TinyInt, input.nivel)
        .input("AVALIACAO_EFICACIA_EM", db_1.sql.DateTime2, input.avaliadoEm ?? new Date())
        .query(`
      UPDATE ut
      SET
        ut.AVALIACAO_EFICACIA_NIVEL = @AVALIACAO_EFICACIA_NIVEL,
        ut.AVALIACAO_EFICACIA_EM = @AVALIACAO_EFICACIA_EM
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      OUTER APPLY (
        SELECT TOP 1 vv.TRILHA_FK_ID AS TRILHA_ID
        FROM dbo.TVIDEOS vv
        WHERE ut.TIPO = 'video'
          AND vv.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND vv.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE
            WHEN ut.MATERIAL_VERSAO IS NOT NULL AND vv.VERSAO = ut.MATERIAL_VERSAO THEN 0
            ELSE 1
          END,
          vv.VERSAO DESC
      ) video_ref
      OUTER APPLY (
        SELECT TOP 1 pp.TRILHA_FK_ID AS TRILHA_ID
        FROM dbo.TPDFS pp
        WHERE ut.TIPO = 'pdf'
          AND pp.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND pp.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE
            WHEN ut.MATERIAL_VERSAO IS NOT NULL AND pp.VERSAO = ut.MATERIAL_VERSAO THEN 0
            ELSE 1
          END,
          pp.VERSAO DESC
      ) pdf_ref
      OUTER APPLY (
        SELECT TOP 1 pr.TRILHA_FK_ID AS TRILHA_ID
        FROM dbo.TPROVAS pr
        WHERE ut.TIPO = 'prova'
          AND pr.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND pr.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE
            WHEN ut.MATERIAL_VERSAO IS NOT NULL AND pr.VERSAO = ut.MATERIAL_VERSAO THEN 0
            ELSE 1
          END,
          pr.VERSAO DESC
      ) prova_ref
      WHERE ut.USUARIO_CPF = @USUARIO_CPF
        AND ut.ARQUIVADO_EM IS NULL
        AND ut.TIPO IN ('video', 'pdf', 'prova')
        AND COALESCE(video_ref.TRILHA_ID, pdf_ref.TRILHA_ID, prova_ref.TRILHA_ID) = @TRILHA_ID
    `);
    return result.rowsAffected[0] ?? 0;
}
async function recordTrainingEficaciaByTurma(input) {
    await ensureUserTrainingEficaciaColumns();
    const pool = await (0, db_1.getPool)();
    let updated = 0;
    let processed = 0;
    const avaliadoEm = input.avaliadoEm ?? new Date();
    for (const avaliacao of input.avaliacoes) {
        // eslint-disable-next-line no-await-in-loop
        const result = await pool
            .request()
            .input("USUARIO_CPF", db_1.sql.VarChar(100), avaliacao.cpf)
            .input("TURMA_ID", db_1.sql.UniqueIdentifier, input.turmaId)
            .input("AVALIACAO_EFICACIA_NIVEL", db_1.sql.TinyInt, avaliacao.nivel)
            .input("AVALIACAO_EFICACIA_EM", db_1.sql.DateTime2, avaliadoEm)
            .query(`
        UPDATE ut
        SET
          ut.AVALIACAO_EFICACIA_NIVEL = @AVALIACAO_EFICACIA_NIVEL,
          ut.AVALIACAO_EFICACIA_EM = @AVALIACAO_EFICACIA_EM
        FROM dbo.TUSUARIO_TREINAMENTOS ut
        WHERE ut.USUARIO_CPF = @USUARIO_CPF
          AND ut.TURMA_ID = @TURMA_ID
          AND ut.ARQUIVADO_EM IS NULL
          AND ut.TIPO IN ('video', 'pdf', 'prova')
      `);
        processed += 1;
        updated += result.rowsAffected[0] ?? 0;
    }
    return { processed, updated };
}
async function getTrainingEficaciaSummary() {
    try {
        await ensureUserTrainingEficaciaColumns();
    }
    catch (error) {
        const code = error && typeof error === "object" && "code" in error
            ? String(error.code ?? "")
            : "";
        if (code === "USER_TRAINING_EFICACY_COLUMNS_MISSING") {
            return [];
        }
        throw error;
    }
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    ;WITH UT_EFICACIA AS (
      SELECT
        ut.USUARIO_CPF,
        ut.TIPO,
        ut.MATERIAL_ID,
        ut.MATERIAL_VERSAO,
        ut.AVALIACAO_EFICACIA_NIVEL,
        ut.AVALIACAO_EFICACIA_EM
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      WHERE ut.ARQUIVADO_EM IS NULL
        AND ut.TIPO IN ('video', 'pdf', 'prova')
        AND ut.AVALIACAO_EFICACIA_NIVEL BETWEEN 1 AND 5
        AND ut.AVALIACAO_EFICACIA_EM IS NOT NULL
    ),
    AVALIACOES_DISTINTAS AS (
      SELECT DISTINCT
        ut.USUARIO_CPF,
        COALESCE(vr.TRILHA_ID, pr.TRILHA_ID, tvr.TRILHA_ID) AS TRILHA_ID,
        ut.AVALIACAO_EFICACIA_NIVEL AS NIVEL,
        ut.AVALIACAO_EFICACIA_EM AS AVALIADO_EM
      FROM UT_EFICACIA ut
      OUTER APPLY (
        SELECT TOP 1 v.TRILHA_FK_ID AS TRILHA_ID
        FROM dbo.TVIDEOS v
        WHERE ut.TIPO = 'video'
          AND v.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND v.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE WHEN ut.MATERIAL_VERSAO IS NOT NULL AND v.VERSAO = ut.MATERIAL_VERSAO THEN 0 ELSE 1 END,
          v.VERSAO DESC
      ) vr
      OUTER APPLY (
        SELECT TOP 1 p.TRILHA_FK_ID AS TRILHA_ID
        FROM dbo.TPDFS p
        WHERE ut.TIPO = 'pdf'
          AND p.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND p.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE WHEN ut.MATERIAL_VERSAO IS NOT NULL AND p.VERSAO = ut.MATERIAL_VERSAO THEN 0 ELSE 1 END,
          p.VERSAO DESC
      ) pr
      OUTER APPLY (
        SELECT TOP 1 tvp.TRILHA_FK_ID AS TRILHA_ID
        FROM dbo.TPROVAS tvp
        WHERE ut.TIPO = 'prova'
          AND tvp.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND tvp.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE WHEN ut.MATERIAL_VERSAO IS NOT NULL AND tvp.VERSAO = ut.MATERIAL_VERSAO THEN 0 ELSE 1 END,
          tvp.VERSAO DESC
      ) tvr
      WHERE COALESCE(vr.TRILHA_ID, pr.TRILHA_ID, tvr.TRILHA_ID) IS NOT NULL
    )
    SELECT
      NIVEL,
      COUNT(*) AS TOTAL
    FROM AVALIACOES_DISTINTAS
    GROUP BY NIVEL
    ORDER BY NIVEL
  `);
    return result.recordset;
}
async function getIndividualTrainingHoursMonthlySummaryLast12Months(referenceDate = new Date()) {
    await archiveExpiredNormaTrainings();
    const pool = await (0, db_1.getPool)();
    const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const rangeStart = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - 11, 1);
    const result = await pool
        .request()
        .input("RANGE_START", db_1.sql.DateTime2, rangeStart)
        .query(`
      SELECT
        YEAR(ut.DT_CONCLUSAO) AS ANO,
        MONTH(ut.DT_CONCLUSAO) AS MES,
        CAST(SUM(CAST(ISNULL(vr.DURACAO_SEGUNDOS, 0) AS DECIMAL(18, 2))) / 3600.0 AS DECIMAL(18, 2)) AS TOTAL_HORAS
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      OUTER APPLY (
        SELECT TOP 1 v.DURACAO_SEGUNDOS
        FROM dbo.TVIDEOS v
        WHERE v.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND v.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE WHEN ut.MATERIAL_VERSAO IS NOT NULL AND v.VERSAO = ut.MATERIAL_VERSAO THEN 0 ELSE 1 END,
          v.VERSAO DESC
      ) vr
      WHERE ut.TIPO = 'video'
        AND ut.ARQUIVADO_EM IS NULL
        AND ut.TURMA_ID IS NULL
        AND ut.DT_CONCLUSAO >= @RANGE_START
      GROUP BY YEAR(ut.DT_CONCLUSAO), MONTH(ut.DT_CONCLUSAO)
      ORDER BY ANO, MES
    `);
    return result.recordset;
}
async function isVideoAssignedToUser(cpf, videoId) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
        .input("MATERIAL_ID", db_1.sql.UniqueIdentifier, videoId)
        .query(`
      SELECT TOP 1 1 AS EXISTS_ROW
      FROM dbo.TVIDEOS v
      JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = v.TRILHA_FK_ID
      WHERE ut.USUARIO_CPF = @USUARIO_CPF
        AND v.ID = @MATERIAL_ID
    `);
    return result.recordset.length > 0;
}
async function listUserVideoCompletions(cpf) {
    await archiveExpiredNormaTrainings();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
        .query(`
      SELECT
        ut.USUARIO_CPF,
        u.NOME AS USUARIO_NOME,
        u.CARGO AS USUARIO_FUNCAO,
        ut.TURMA_ID,
        turma.NOME AS TURMA_NOME,
        ut.MATERIAL_ID,
        ut.MATERIAL_VERSAO,
        ut.DT_CONCLUSAO,
        ut.ORIGEM,
        ut.ARQUIVADO_EM,
        v.TRILHA_FK_ID AS TRILHA_ID,
        t.TITULO AS TRILHA_TITULO,
        t.MODULO_FK_ID AS MODULO_ID,
        m.NOME AS MODULO_NOME,
        v.PATH_VIDEO
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      OUTER APPLY (
        SELECT TOP 1 vv.TRILHA_FK_ID, vv.PATH_VIDEO
        FROM dbo.TVIDEOS vv
        WHERE vv.ID = ut.MATERIAL_ID
          AND (
            ut.MATERIAL_VERSAO IS NULL
            OR vv.VERSAO = ut.MATERIAL_VERSAO
          )
        ORDER BY vv.VERSAO DESC
      ) v
      JOIN dbo.TTRILHAS t ON t.ID = v.TRILHA_FK_ID
      JOIN dbo.TMODULOS m ON m.ID = t.MODULO_FK_ID
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = ut.USUARIO_CPF
      LEFT JOIN dbo.TTURMAS_TREINAMENTO turma ON turma.ID = ut.TURMA_ID
      WHERE ut.TIPO = 'video'
        AND ut.USUARIO_CPF = @USUARIO_CPF
        AND ut.ARQUIVADO_EM IS NULL
        AND v.TRILHA_FK_ID IS NOT NULL
      ORDER BY ut.DT_CONCLUSAO DESC
    `);
    return result.recordset;
}
async function listVideoCompletionsByMaterial(materialId, versao) {
    await archiveExpiredNormaTrainings();
    const pool = await (0, db_1.getPool)();
    const request = pool
        .request()
        .input("MATERIAL_ID", db_1.sql.UniqueIdentifier, materialId);
    let versaoClause = "";
    if (versao !== undefined) {
        request.input("MATERIAL_VERSAO", db_1.sql.Int, versao);
        versaoClause = "AND ut.MATERIAL_VERSAO = @MATERIAL_VERSAO";
    }
    const result = await request.query(`
      SELECT
        ut.USUARIO_CPF,
        u.NOME AS USUARIO_NOME,
        u.CARGO AS USUARIO_FUNCAO,
        ut.TURMA_ID,
        turma.NOME AS TURMA_NOME,
        ut.MATERIAL_ID,
        ut.MATERIAL_VERSAO,
        ut.DT_CONCLUSAO,
        ut.ORIGEM,
        ut.ARQUIVADO_EM,
        v.TRILHA_FK_ID AS TRILHA_ID,
        t.TITULO AS TRILHA_TITULO,
        t.MODULO_FK_ID AS MODULO_ID,
        m.NOME AS MODULO_NOME,
        v.PATH_VIDEO
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      OUTER APPLY (
        SELECT TOP 1 vv.TRILHA_FK_ID, vv.PATH_VIDEO
        FROM dbo.TVIDEOS vv
        WHERE vv.ID = ut.MATERIAL_ID
          AND (
            ut.MATERIAL_VERSAO IS NULL
            OR vv.VERSAO = ut.MATERIAL_VERSAO
          )
        ORDER BY vv.VERSAO DESC
      ) v
      JOIN dbo.TTRILHAS t ON t.ID = v.TRILHA_FK_ID
      JOIN dbo.TMODULOS m ON m.ID = t.MODULO_FK_ID
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = ut.USUARIO_CPF
      LEFT JOIN dbo.TTURMAS_TREINAMENTO turma ON turma.ID = ut.TURMA_ID
      WHERE ut.TIPO = 'video'
        AND ut.MATERIAL_ID = @MATERIAL_ID
        AND ut.ARQUIVADO_EM IS NULL
        AND v.TRILHA_FK_ID IS NOT NULL
        ${versaoClause}
      ORDER BY ut.DT_CONCLUSAO DESC
  `);
    return result.recordset;
}
async function listCompletionReport(funcao, turma) {
    await archiveExpiredNormaTrainings();
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const filters = [];
    if (funcao) {
        request.input("FUNCAO", db_1.sql.VarChar(250), `%${funcao}%`);
        filters.push("u.CARGO LIKE @FUNCAO");
    }
    if (turma) {
        request.input("TURMA", db_1.sql.NVarChar(250), `%${turma}%`);
        filters.push("turma.NOME LIKE @TURMA");
    }
    const where = filters.length ? `AND ${filters.join(" AND ")}` : "";
    const result = await request.query(`
      WITH V_ULTIMO AS (
        SELECT
          ID,
          TRILHA_FK_ID,
          PATH_VIDEO,
          PROCEDIMENTO_ID,
          NORMA_ID,
          VERSAO,
          ROW_NUMBER() OVER (PARTITION BY ID ORDER BY VERSAO DESC) AS RN
        FROM dbo.TVIDEOS
      ),
      V_LATEST AS (
        SELECT ID, TRILHA_FK_ID, PATH_VIDEO, PROCEDIMENTO_ID, NORMA_ID, VERSAO
        FROM V_ULTIMO
        WHERE RN = 1
      ),
      PROC_LATEST AS (
        SELECT ID, NOME
        FROM (
          SELECT
            p.ID,
            p.NOME,
            ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
          FROM dbo.TPROCEDIMENTOS p
        ) p
        WHERE p.RN = 1
      ),
      NORMA_LATEST AS (
        SELECT ID, NOME
        FROM (
          SELECT
            n.ID,
            n.NOME,
            ROW_NUMBER() OVER (PARTITION BY n.ID ORDER BY n.VERSAO DESC) AS RN
          FROM dbo.TNORMAS n
        ) n
        WHERE n.RN = 1
      ),
      ACTIVE_UT AS (
        SELECT
          ID,
          USUARIO_CPF,
          MATERIAL_ID,
          MATERIAL_VERSAO,
          TURMA_ID,
          DT_CONCLUSAO,
          ORIGEM
        FROM dbo.TUSUARIO_TREINAMENTOS
        WHERE TIPO = 'video'
          AND ARQUIVADO_EM IS NULL
      ),
      TRILHA_TOTAL AS (
        SELECT TRILHA_FK_ID, COUNT(*) AS TOTAL_VIDEOS_TRILHA
        FROM V_LATEST
        GROUP BY TRILHA_FK_ID
      ),
      USER_TRILHA_DONE AS (
        SELECT
          ut.USUARIO_CPF,
          vl.TRILHA_FK_ID,
          COUNT(DISTINCT ut.MATERIAL_ID) AS TOTAL_CONCLUIDOS_TRILHA
        FROM ACTIVE_UT ut
        JOIN V_LATEST vl
          ON vl.ID = ut.MATERIAL_ID
         AND ut.MATERIAL_VERSAO = vl.VERSAO
        GROUP BY ut.USUARIO_CPF, vl.TRILHA_FK_ID
      )
      SELECT
        ut.USUARIO_CPF,
        u.NOME AS USUARIO_NOME,
        u.CARGO AS USUARIO_FUNCAO,
        JSON_VALUE(u.READVIEW_JSON, '$.CODCOLIGADA') AS USUARIO_CODCOLIGADA,
        JSON_VALUE(u.READVIEW_JSON, '$.CODSECAO') AS USUARIO_CODSECAO,
        COALESCE(
          JSON_VALUE(u.READVIEW_JSON, '$.ESTADOSECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.ESTADO_SECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.UFSECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.ESTADO'),
          JSON_VALUE(u.READVIEW_JSON, '$.UF')
        ) AS USUARIO_ESTADO,
        COALESCE(
          JSON_VALUE(u.READVIEW_JSON, '$.CIDADESECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.CIDADE_SECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.CIDADE')
        ) AS USUARIO_CIDADE,
        COALESCE(
          JSON_VALUE(u.READVIEW_JSON, '$.DESCRICAOSECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.NOME_SECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.NOMEDEPARTAMENTO'),
          u.SETOR
        ) AS USUARIO_LOCAL_DESCRICAO,
        ut.TURMA_ID,
        turma.NOME AS TURMA_NOME,
        ut.MATERIAL_ID,
        ut.MATERIAL_VERSAO,
        ut.DT_CONCLUSAO,
        ut.ORIGEM,
        CAST(NULL AS DATETIME2) AS ARQUIVADO_EM,
        vl.PROCEDIMENTO_ID,
        proc_latest.NOME AS PROCEDIMENTO_NOME,
        vl.NORMA_ID,
        norma_latest.NOME AS NORMA_NOME,
        vl.TRILHA_FK_ID AS TRILHA_ID,
        t.TITULO AS TRILHA_TITULO,
        t.MODULO_FK_ID AS MODULO_ID,
        m.NOME AS MODULO_NOME,
        vl.PATH_VIDEO,
        ISNULL(tt.TOTAL_VIDEOS_TRILHA, 0) AS TOTAL_VIDEOS_TRILHA,
        ISNULL(ud.TOTAL_CONCLUIDOS_TRILHA, 0) AS TOTAL_CONCLUIDOS_TRILHA,
        CAST(
          CASE
            WHEN ISNULL(tt.TOTAL_VIDEOS_TRILHA, 0) > 0
              AND ISNULL(ud.TOTAL_CONCLUIDOS_TRILHA, 0) >= ISNULL(tt.TOTAL_VIDEOS_TRILHA, 0)
            THEN 1
            ELSE 0
          END AS BIT
        ) AS TRILHA_FINALIZADA
      FROM ACTIVE_UT ut
      JOIN V_LATEST vl
        ON vl.ID = ut.MATERIAL_ID
       AND ut.MATERIAL_VERSAO = vl.VERSAO
      JOIN dbo.TTRILHAS t ON t.ID = vl.TRILHA_FK_ID
      JOIN dbo.TMODULOS m ON m.ID = t.MODULO_FK_ID
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = ut.USUARIO_CPF
      LEFT JOIN dbo.TTURMAS_TREINAMENTO turma ON turma.ID = ut.TURMA_ID
      LEFT JOIN PROC_LATEST proc_latest ON proc_latest.ID = vl.PROCEDIMENTO_ID
      LEFT JOIN NORMA_LATEST norma_latest ON norma_latest.ID = vl.NORMA_ID
      LEFT JOIN TRILHA_TOTAL tt ON tt.TRILHA_FK_ID = vl.TRILHA_FK_ID
      LEFT JOIN USER_TRILHA_DONE ud
        ON ud.USUARIO_CPF = ut.USUARIO_CPF
        AND ud.TRILHA_FK_ID = vl.TRILHA_FK_ID
      WHERE 1 = 1
      ${where}
      ORDER BY ut.DT_CONCLUSAO DESC
    `);
    return result.recordset;
}
async function listArchivedCompletionReport(funcao, turma) {
    await archiveExpiredNormaTrainings();
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const filters = [];
    if (funcao) {
        request.input("FUNCAO", db_1.sql.VarChar(250), `%${funcao}%`);
        filters.push("u.CARGO LIKE @FUNCAO");
    }
    if (turma) {
        request.input("TURMA", db_1.sql.NVarChar(250), `%${turma}%`);
        filters.push("turma.NOME LIKE @TURMA");
    }
    const where = filters.length ? `AND ${filters.join(" AND ")}` : "";
    const result = await request.query(`
      SELECT
        ut.USUARIO_CPF,
        u.NOME AS USUARIO_NOME,
        u.CARGO AS USUARIO_FUNCAO,
        JSON_VALUE(u.READVIEW_JSON, '$.CODCOLIGADA') AS USUARIO_CODCOLIGADA,
        JSON_VALUE(u.READVIEW_JSON, '$.CODSECAO') AS USUARIO_CODSECAO,
        COALESCE(
          JSON_VALUE(u.READVIEW_JSON, '$.ESTADOSECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.ESTADO_SECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.UFSECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.ESTADO'),
          JSON_VALUE(u.READVIEW_JSON, '$.UF')
        ) AS USUARIO_ESTADO,
        COALESCE(
          JSON_VALUE(u.READVIEW_JSON, '$.CIDADESECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.CIDADE_SECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.CIDADE')
        ) AS USUARIO_CIDADE,
        COALESCE(
          JSON_VALUE(u.READVIEW_JSON, '$.DESCRICAOSECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.NOME_SECAO'),
          JSON_VALUE(u.READVIEW_JSON, '$.NOMEDEPARTAMENTO'),
          u.SETOR
        ) AS USUARIO_LOCAL_DESCRICAO,
        ut.TURMA_ID,
        turma.NOME AS TURMA_NOME,
        ut.MATERIAL_ID,
        ut.MATERIAL_VERSAO,
        ut.DT_CONCLUSAO,
        ut.ORIGEM,
        ut.ARQUIVADO_EM,
        vh.PROCEDIMENTO_ID,
        proc_latest.NOME AS PROCEDIMENTO_NOME,
        vh.NORMA_ID,
        norma_latest.NOME AS NORMA_NOME,
        vh.TRILHA_FK_ID AS TRILHA_ID,
        t.TITULO AS TRILHA_TITULO,
        t.MODULO_FK_ID AS MODULO_ID,
        m.NOME AS MODULO_NOME,
        vh.PATH_VIDEO,
        va.VERSAO_ATUAL
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      OUTER APPLY (
        SELECT TOP 1 vv.TRILHA_FK_ID, vv.PATH_VIDEO, vv.PROCEDIMENTO_ID, vv.NORMA_ID
        FROM dbo.TVIDEOS vv
        WHERE vv.ID = ut.MATERIAL_ID
          AND (
            (ut.MATERIAL_VERSAO IS NOT NULL AND vv.VERSAO = ut.MATERIAL_VERSAO)
            OR ut.MATERIAL_VERSAO IS NULL
          )
        ORDER BY
          CASE
            WHEN ut.MATERIAL_VERSAO IS NOT NULL AND vv.VERSAO = ut.MATERIAL_VERSAO THEN 0
            ELSE 1
          END,
          vv.VERSAO DESC
      ) vh
      OUTER APPLY (
        SELECT TOP 1 vv.VERSAO AS VERSAO_ATUAL
        FROM dbo.TVIDEOS vv
        WHERE vv.ID = ut.MATERIAL_ID
        ORDER BY vv.VERSAO DESC
      ) va
      LEFT JOIN dbo.TTRILHAS t ON t.ID = vh.TRILHA_FK_ID
      LEFT JOIN dbo.TMODULOS m ON m.ID = t.MODULO_FK_ID
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = ut.USUARIO_CPF
      LEFT JOIN dbo.TTURMAS_TREINAMENTO turma ON turma.ID = ut.TURMA_ID
      LEFT JOIN (
        SELECT ID, NOME
        FROM (
          SELECT
            p.ID,
            p.NOME,
            ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
          FROM dbo.TPROCEDIMENTOS p
        ) p
        WHERE p.RN = 1
      ) proc_latest ON proc_latest.ID = vh.PROCEDIMENTO_ID
      LEFT JOIN (
        SELECT ID, NOME
        FROM (
          SELECT
            n.ID,
            n.NOME,
            ROW_NUMBER() OVER (PARTITION BY n.ID ORDER BY n.VERSAO DESC) AS RN
          FROM dbo.TNORMAS n
        ) n
        WHERE n.RN = 1
      ) norma_latest ON norma_latest.ID = vh.NORMA_ID
      WHERE ut.TIPO = 'video'
        AND ut.ARQUIVADO_EM IS NOT NULL
        AND vh.TRILHA_FK_ID IS NOT NULL
        ${where}
      ORDER BY ut.ARQUIVADO_EM DESC, ut.DT_CONCLUSAO DESC
    `);
    return result.recordset;
}
async function archiveVideoCompletionsByVideoId(videoId, archivedAt = new Date()) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("MATERIAL_ID", db_1.sql.UniqueIdentifier, videoId)
        .input("ARQUIVADO_EM", db_1.sql.DateTime2, archivedAt)
        .query(`
      UPDATE dbo.TUSUARIO_TREINAMENTOS
      SET ARQUIVADO_EM = @ARQUIVADO_EM
      WHERE TIPO = 'video'
        AND MATERIAL_ID = @MATERIAL_ID
        AND ARQUIVADO_EM IS NULL
    `);
    return result.rowsAffected[0] ?? 0;
}
async function archiveTrainingProgressByTrilhaIds(trilhaIds, archivedAt = new Date()) {
    const normalizedTrilhaIds = Array.from(new Set((Array.isArray(trilhaIds) ? trilhaIds : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)));
    if (normalizedTrilhaIds.length === 0) {
        return {
            materiaisArquivados: 0,
            provasArquivadas: 0,
        };
    }
    const pool = await (0, db_1.getPool)();
    const trilhaIdsCsv = normalizedTrilhaIds.join(",");
    const materialsResult = await pool
        .request()
        .input("TRILHA_IDS", db_1.sql.NVarChar(db_1.sql.MAX), trilhaIdsCsv)
        .input("ARQUIVADO_EM", db_1.sql.DateTime2, archivedAt)
        .query(`
      ;WITH TRILHAS AS (
        SELECT DISTINCT TRY_CONVERT(UNIQUEIDENTIFIER, value) AS TRILHA_ID
        FROM STRING_SPLIT(@TRILHA_IDS, ',')
        WHERE TRY_CONVERT(UNIQUEIDENTIFIER, value) IS NOT NULL
      )
      UPDATE ut
      SET ARQUIVADO_EM = @ARQUIVADO_EM
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      WHERE ut.ARQUIVADO_EM IS NULL
        AND (
          (
            ut.TIPO = 'video'
            AND EXISTS (
              SELECT 1
              FROM dbo.TVIDEOS v
              JOIN TRILHAS t ON t.TRILHA_ID = v.TRILHA_FK_ID
              WHERE v.ID = ut.MATERIAL_ID
            )
          )
          OR (
            ut.TIPO = 'pdf'
            AND EXISTS (
              SELECT 1
              FROM dbo.TPDFS p
              JOIN TRILHAS t ON t.TRILHA_ID = p.TRILHA_FK_ID
              WHERE p.ID = ut.MATERIAL_ID
            )
          )
        )
    `);
    const provasResult = await pool
        .request()
        .input("TRILHA_IDS", db_1.sql.NVarChar(db_1.sql.MAX), trilhaIdsCsv)
        .input("ARQUIVADO_EM", db_1.sql.DateTime2, archivedAt)
        .query(`
      ;WITH TRILHAS AS (
        SELECT DISTINCT TRY_CONVERT(UNIQUEIDENTIFIER, value) AS TRILHA_ID
        FROM STRING_SPLIT(@TRILHA_IDS, ',')
        WHERE TRY_CONVERT(UNIQUEIDENTIFIER, value) IS NOT NULL
      )
      UPDATE ut
      SET ARQUIVADO_EM = @ARQUIVADO_EM
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      WHERE ut.TIPO = 'prova'
        AND ut.ARQUIVADO_EM IS NULL
        AND EXISTS (
          SELECT 1
          FROM dbo.TPROVAS pr
          JOIN TRILHAS t ON t.TRILHA_ID = pr.TRILHA_FK_ID
          WHERE pr.ID = ut.MATERIAL_ID
        )
    `);
    return {
        materiaisArquivados: materialsResult.rowsAffected[0] ?? 0,
        provasArquivadas: provasResult.rowsAffected[0] ?? 0,
    };
}
async function archiveTrainingsByProcedimentoId(procedimentoId, archivedAt = new Date()) {
    const pool = await (0, db_1.getPool)();
    const trilhaColumnState = await (0, trilhaModel_1.getTrilhaColumnState)();
    const materialsResult = await pool
        .request()
        .input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, procedimentoId)
        .input("ARQUIVADO_EM", db_1.sql.DateTime2, archivedAt)
        .query(`
      ;WITH V_LATEST AS (
        SELECT
          v.ID,
          v.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
      ),
      P_LATEST AS (
        SELECT
          p.ID,
          p.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPDFS p
      ),
      MATERIAIS AS (
        SELECT CAST('video' AS VARCHAR(20)) AS TIPO, v.ID AS MATERIAL_ID
        FROM V_LATEST v
        WHERE v.RN = 1
          AND v.PROCEDIMENTO_ID = @PROCEDIMENTO_ID

        UNION ALL

        SELECT CAST('pdf' AS VARCHAR(20)) AS TIPO, p.ID AS MATERIAL_ID
        FROM P_LATEST p
        WHERE p.RN = 1
          AND p.PROCEDIMENTO_ID = @PROCEDIMENTO_ID
      )
      UPDATE ut
      SET ARQUIVADO_EM = @ARQUIVADO_EM
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      JOIN MATERIAIS m
        ON m.TIPO = ut.TIPO
       AND m.MATERIAL_ID = ut.MATERIAL_ID
      WHERE ut.ARQUIVADO_EM IS NULL
    `);
    const provasResult = await pool
        .request()
        .input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, procedimentoId)
        .input("ARQUIVADO_EM", db_1.sql.DateTime2, archivedAt)
        .query(`
      ;WITH V_LATEST AS (
        SELECT
          v.TRILHA_FK_ID,
          v.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
      ),
      P_LATEST AS (
        SELECT
          p.TRILHA_FK_ID,
          p.PROCEDIMENTO_ID,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPDFS p
      ),
      TRILHAS_AFETADAS AS (
        SELECT DISTINCT v.TRILHA_FK_ID AS TRILHA_ID
        FROM V_LATEST v
        WHERE v.RN = 1
          AND v.PROCEDIMENTO_ID = @PROCEDIMENTO_ID

        UNION

        SELECT DISTINCT p.TRILHA_FK_ID AS TRILHA_ID
        FROM P_LATEST p
        WHERE p.RN = 1
          AND p.PROCEDIMENTO_ID = @PROCEDIMENTO_ID
        ${trilhaColumnState.hasProcedimentoId
        ? `

        UNION

        SELECT DISTINCT tr.ID AS TRILHA_ID
        FROM dbo.TTRILHAS tr
        WHERE tr.PROCEDIMENTO_ID = @PROCEDIMENTO_ID`
        : ""}
      )
      UPDATE ut
      SET ARQUIVADO_EM = @ARQUIVADO_EM
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      WHERE ut.TIPO = 'prova'
        AND ut.ARQUIVADO_EM IS NULL
        AND EXISTS (
          SELECT 1
          FROM dbo.TPROVAS pr
          JOIN TRILHAS_AFETADAS ta ON ta.TRILHA_ID = pr.TRILHA_FK_ID
          WHERE pr.ID = ut.MATERIAL_ID
        )
    `);
    return {
        materiaisArquivados: materialsResult.rowsAffected[0] ?? 0,
        provasArquivadas: provasResult.rowsAffected[0] ?? 0,
    };
}
async function archiveTrainingsByNormaId(normaId, archivedAt = new Date()) {
    const pool = await (0, db_1.getPool)();
    const trilhaColumnState = await (0, trilhaModel_1.getTrilhaColumnState)();
    const materialsResult = await pool
        .request()
        .input("NORMA_ID", db_1.sql.UniqueIdentifier, normaId)
        .input("ARQUIVADO_EM", db_1.sql.DateTime2, archivedAt)
        .query(`
      ;WITH V_LATEST AS (
        SELECT
          v.ID,
          v.NORMA_ID,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
      ),
      P_LATEST AS (
        SELECT
          p.ID,
          p.NORMA_ID,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPDFS p
      ),
      MATERIAIS AS (
        SELECT CAST('video' AS VARCHAR(20)) AS TIPO, v.ID AS MATERIAL_ID
        FROM V_LATEST v
        WHERE v.RN = 1
          AND v.NORMA_ID = @NORMA_ID

        UNION ALL

        SELECT CAST('pdf' AS VARCHAR(20)) AS TIPO, p.ID AS MATERIAL_ID
        FROM P_LATEST p
        WHERE p.RN = 1
          AND p.NORMA_ID = @NORMA_ID
      )
      UPDATE ut
      SET ARQUIVADO_EM = @ARQUIVADO_EM
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      JOIN MATERIAIS m
        ON m.TIPO = ut.TIPO
       AND m.MATERIAL_ID = ut.MATERIAL_ID
      WHERE ut.ARQUIVADO_EM IS NULL
    `);
    const provasResult = await pool
        .request()
        .input("NORMA_ID", db_1.sql.UniqueIdentifier, normaId)
        .input("ARQUIVADO_EM", db_1.sql.DateTime2, archivedAt)
        .query(`
      ;WITH V_LATEST AS (
        SELECT
          v.TRILHA_FK_ID,
          v.NORMA_ID,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
      ),
      P_LATEST AS (
        SELECT
          p.TRILHA_FK_ID,
          p.NORMA_ID,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPDFS p
      ),
      TRILHAS_AFETADAS AS (
        SELECT DISTINCT v.TRILHA_FK_ID AS TRILHA_ID
        FROM V_LATEST v
        WHERE v.RN = 1
          AND v.NORMA_ID = @NORMA_ID

        UNION

        SELECT DISTINCT p.TRILHA_FK_ID AS TRILHA_ID
        FROM P_LATEST p
        WHERE p.RN = 1
          AND p.NORMA_ID = @NORMA_ID
        ${trilhaColumnState.hasNormaId
        ? `

        UNION

        SELECT DISTINCT tr.ID AS TRILHA_ID
        FROM dbo.TTRILHAS tr
        WHERE tr.NORMA_ID = @NORMA_ID`
        : ""}
      )
      UPDATE ut
      SET ARQUIVADO_EM = @ARQUIVADO_EM
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      WHERE ut.TIPO = 'prova'
        AND ut.ARQUIVADO_EM IS NULL
        AND EXISTS (
          SELECT 1
          FROM dbo.TPROVAS pr
          JOIN TRILHAS_AFETADAS ta ON ta.TRILHA_ID = pr.TRILHA_FK_ID
          WHERE pr.ID = ut.MATERIAL_ID
        )
    `);
    return {
        materiaisArquivados: materialsResult.rowsAffected[0] ?? 0,
        provasArquivadas: provasResult.rowsAffected[0] ?? 0,
    };
}
async function getUserCurrentVideoProgressByTrilha(cpf, trilhaId) {
    await archiveExpiredNormaTrainings();
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("USUARIO_CPF", db_1.sql.VarChar(100), cpf)
        .input("TRILHA_ID", db_1.sql.UniqueIdentifier, trilhaId)
        .query(`
      WITH V_ULTIMO AS (
        SELECT
          ID,
          TRILHA_FK_ID,
          VERSAO,
          ROW_NUMBER() OVER (PARTITION BY ID ORDER BY VERSAO DESC) AS RN
        FROM dbo.TVIDEOS
        WHERE TRILHA_FK_ID = @TRILHA_ID
      ),
      V_LATEST AS (
        SELECT ID, TRILHA_FK_ID, VERSAO
        FROM V_ULTIMO
        WHERE RN = 1
      ),
      UT_ATIVO AS (
        SELECT
          MATERIAL_ID,
          MATERIAL_VERSAO,
          DT_CONCLUSAO
        FROM dbo.TUSUARIO_TREINAMENTOS
        WHERE USUARIO_CPF = @USUARIO_CPF
          AND TIPO = 'video'
          AND ARQUIVADO_EM IS NULL
      ),
      UT_ATUAL AS (
        SELECT
          ut.MATERIAL_ID,
          ut.DT_CONCLUSAO
        FROM UT_ATIVO ut
        JOIN V_LATEST vl
          ON vl.ID = ut.MATERIAL_ID
         AND vl.VERSAO = ut.MATERIAL_VERSAO
      )
      SELECT
        (SELECT COUNT(*) FROM V_LATEST) AS TOTAL_VIDEOS_ATUAIS,
        (SELECT COUNT(DISTINCT MATERIAL_ID) FROM UT_ATUAL) AS TOTAL_CONCLUIDOS_ATUAIS,
        (SELECT MAX(DT_CONCLUSAO) FROM UT_ATUAL) AS ULTIMA_CONCLUSAO_ATUAL
    `);
    const row = result.recordset[0];
    return (row ?? {
        TOTAL_VIDEOS_ATUAIS: 0,
        TOTAL_CONCLUIDOS_ATUAIS: 0,
        ULTIMA_CONCLUSAO_ATUAL: null,
    });
}
