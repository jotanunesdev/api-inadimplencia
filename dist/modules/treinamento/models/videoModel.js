"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVideos = listVideos;
exports.getVideoById = getVideoById;
exports.createVideo = createVideo;
exports.updateVideo = updateVideo;
exports.deleteVideo = deleteVideo;
exports.setVideoOrder = setVideoOrder;
exports.syncTrilhaVideosFromChannelVersion = syncTrilhaVideosFromChannelVersion;
const db_1 = require("../config/db");
const userTrainingModel_1 = require("./userTrainingModel");
const pdfModel_1 = require("./pdfModel");
const sectorFolderExternalItemModel_1 = require("./sectorFolderExternalItemModel");
async function resolveExternalVideoReferences(records) {
    const externalItemIds = Array.from(new Set(records
        .map((record) => (0, sectorFolderExternalItemModel_1.parseYouTubeStoredPathToken)(record.PATH_VIDEO))
        .filter(Boolean)));
    if (externalItemIds.length === 0) {
        return records.map((record) => ({
            ...record,
            STORED_PATH: record.PATH_VIDEO,
            NOME_EXIBICAO: record.NOME_EXIBICAO ?? null,
            FONTE_CONTEUDO: record.FONTE_CONTEUDO ?? null,
        }));
    }
    let externalItems = [];
    try {
        externalItems = await (0, sectorFolderExternalItemModel_1.listSectorFolderExternalItemsByIds)(externalItemIds);
    }
    catch (error) {
        if (!(0, sectorFolderExternalItemModel_1.isSectorFolderExternalItemTableMissingError)(error)) {
            throw error;
        }
    }
    const externalItemById = new Map(externalItems.map((item) => [item.id, item]));
    return records.map((record) => {
        const externalItemId = (0, sectorFolderExternalItemModel_1.parseYouTubeStoredPathToken)(record.PATH_VIDEO);
        const externalItem = externalItemId
            ? externalItemById.get(externalItemId) ?? null
            : null;
        if (!externalItem) {
            return {
                ...record,
                STORED_PATH: record.PATH_VIDEO,
                NOME_EXIBICAO: record.NOME_EXIBICAO ?? null,
                FONTE_CONTEUDO: record.FONTE_CONTEUDO ?? null,
                CAMINHO_EXTERNO: record.CAMINHO_EXTERNO ?? null,
            };
        }
        return {
            ...record,
            STORED_PATH: record.PATH_VIDEO,
            PATH_VIDEO: externalItem.url,
            NOME_EXIBICAO: externalItem.name,
            FONTE_CONTEUDO: externalItem.linkType || sectorFolderExternalItemModel_1.YOUTUBE_EXTERNAL_ITEM_TYPE,
            CAMINHO_EXTERNO: externalItem.path,
        };
    });
}
async function listVideos(trilhaId, cpf, includePdf = false) {
    const hasPdfOrder = includePdf ? await (0, pdfModel_1.hasPdfOrderColumn)() : false;
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const conditions = [];
    let join = "";
    if (cpf) {
        request.input("USUARIO_CPF", db_1.sql.VarChar(100), cpf);
        join = "JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = v.TRILHA_FK_ID";
        conditions.push("ut.USUARIO_CPF = @USUARIO_CPF");
    }
    if (trilhaId) {
        request.input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, trilhaId);
        conditions.push("v.TRILHA_FK_ID = @TRILHA_FK_ID");
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const videoSource = `
      SELECT
        v.ID,
        v.TRILHA_FK_ID,
        v.PATH_VIDEO,
        CAST('video' AS VARCHAR(20)) AS TIPO_CONTEUDO,
        v.PROCEDIMENTO_ID,
        v.NORMA_ID,
        v.VERSAO,
        v.DURACAO_SEGUNDOS,
        v.ORDEM
      FROM (
        SELECT
          v.ID,
          v.TRILHA_FK_ID,
          v.PATH_VIDEO,
          v.PROCEDIMENTO_ID,
          v.NORMA_ID,
          v.VERSAO,
          v.DURACAO_SEGUNDOS,
          v.ORDEM,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
        ${join}
        ${where}
      ) v
      WHERE v.RN = 1
  `;
    const pdfJoin = cpf
        ? "JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = p.TRILHA_FK_ID"
        : "";
    const pdfConditions = [...conditions];
    const pdfWhere = pdfConditions.length
        ? `WHERE ${pdfConditions.map((condition) => condition.replace(/\bv\./g, "p.")).join(" AND ")}`
        : "";
    const pdfSource = `
      SELECT
        p.ID,
        p.TRILHA_FK_ID,
        p.PDF_PATH AS PATH_VIDEO,
        CAST('pdf' AS VARCHAR(20)) AS TIPO_CONTEUDO,
        p.PROCEDIMENTO_ID,
        p.NORMA_ID,
        p.VERSAO,
        CAST(0 AS INT) AS DURACAO_SEGUNDOS,
        ${hasPdfOrder ? "p.ORDEM" : "CAST(NULL AS INT) AS ORDEM"}
      FROM (
        SELECT
          p.ID,
          p.TRILHA_FK_ID,
          p.PDF_PATH,
          p.PROCEDIMENTO_ID,
          p.NORMA_ID,
          ${hasPdfOrder ? "p.ORDEM," : ""}
          p.VERSAO,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPDFS p
        ${pdfJoin}
        ${pdfWhere}
      ) p
      WHERE p.RN = 1
  `;
    const materialsSource = includePdf ? `${videoSource} UNION ALL ${pdfSource}` : videoSource;
    const result = await request.query(`
    SELECT
      v.ID,
      v.TRILHA_FK_ID,
      v.PATH_VIDEO,
      v.TIPO_CONTEUDO,
      v.PROCEDIMENTO_ID,
      v.NORMA_ID,
      pObs.OBSERVACOES AS PROCEDIMENTO_OBSERVACOES,
      nObs.OBSERVACOES AS NORMA_OBSERVACOES,
      v.VERSAO,
      v.DURACAO_SEGUNDOS,
      v.ORDEM
    FROM (
      ${materialsSource}
    ) v
    OUTER APPLY (
      SELECT TOP 1 p.OBSERVACOES
      FROM dbo.TPROCEDIMENTOS p
      WHERE p.ID = v.PROCEDIMENTO_ID
      ORDER BY p.VERSAO DESC
    ) pObs
    OUTER APPLY (
      SELECT TOP 1 n.OBSERVACOES
      FROM dbo.TNORMAS n
      WHERE n.ID = v.NORMA_ID
      ORDER BY n.VERSAO DESC
    ) nObs
    ORDER BY v.TRILHA_FK_ID, ISNULL(v.ORDEM, 2147483647), v.ID
  `);
    return resolveExternalVideoReferences(result.recordset);
}
async function getVideoById(id, versao) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request().input("ID", db_1.sql.UniqueIdentifier, id);
    if (versao !== undefined) {
        request.input("VERSAO", db_1.sql.Int, versao);
        const result = await request.query("SELECT * FROM dbo.TVIDEOS WHERE ID = @ID AND VERSAO = @VERSAO");
        const records = await resolveExternalVideoReferences(result.recordset);
        return records[0];
    }
    const result = await request.query("SELECT TOP 1 * FROM dbo.TVIDEOS WHERE ID = @ID ORDER BY VERSAO DESC");
    const records = await resolveExternalVideoReferences(result.recordset);
    return records[0];
}
async function createVideo(input) {
    const pool = await (0, db_1.getPool)();
    let ordem = input.ordem ?? null;
    if (ordem === null) {
        const maxOrderResult = await pool
            .request()
            .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, input.trilhaId)
            .query("SELECT ISNULL(MAX(ORDEM), 0) AS MAX_ORDEM FROM dbo.TVIDEOS WHERE TRILHA_FK_ID = @TRILHA_FK_ID");
        ordem = (maxOrderResult.recordset[0]?.MAX_ORDEM ?? 0) + 1;
    }
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.id)
        .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, input.trilhaId)
        .input("PATH_VIDEO", db_1.sql.NVarChar(1000), input.pathVideo)
        .input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, input.procedimentoId ?? null)
        .input("NORMA_ID", db_1.sql.UniqueIdentifier, input.normaId ?? null)
        .input("DURACAO_SEGUNDOS", db_1.sql.Int, input.duracaoSegundos ?? 0)
        .input("ORDEM", db_1.sql.Int, ordem)
        .input("VERSAO", db_1.sql.Int, 1)
        .query("INSERT INTO dbo.TVIDEOS (ID, TRILHA_FK_ID, PATH_VIDEO, PROCEDIMENTO_ID, NORMA_ID, DURACAO_SEGUNDOS, ORDEM, VERSAO) VALUES (@ID, @TRILHA_FK_ID, @PATH_VIDEO, @PROCEDIMENTO_ID, @NORMA_ID, @DURACAO_SEGUNDOS, @ORDEM, @VERSAO)");
    return getVideoById(input.id);
}
async function updateVideo(id, input) {
    const pool = await (0, db_1.getPool)();
    const latestResult = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("SELECT TOP 1 * FROM dbo.TVIDEOS WHERE ID = @ID ORDER BY VERSAO DESC");
    const latest = latestResult.recordset[0];
    if (!latest) {
        return undefined;
    }
    const nextVersion = (latest.VERSAO ?? 0) + 1;
    const trilhaId = input.trilhaId ?? latest.TRILHA_FK_ID;
    const pathVideo = input.pathVideo ?? latest.PATH_VIDEO ?? "";
    const procedimentoId = input.procedimentoId !== undefined
        ? input.procedimentoId
        : latest.PROCEDIMENTO_ID;
    const normaId = input.normaId !== undefined
        ? input.normaId
        : latest.NORMA_ID;
    const duracaoSegundos = input.duracaoSegundos ?? latest.DURACAO_SEGUNDOS ?? 0;
    const ordem = input.ordem ?? latest.ORDEM ?? 0;
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("TRILHA_FK_ID", db_1.sql.UniqueIdentifier, trilhaId)
        .input("PATH_VIDEO", db_1.sql.NVarChar(1000), pathVideo)
        .input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, procedimentoId ?? null)
        .input("NORMA_ID", db_1.sql.UniqueIdentifier, normaId ?? null)
        .input("DURACAO_SEGUNDOS", db_1.sql.Int, duracaoSegundos)
        .input("ORDEM", db_1.sql.Int, ordem)
        .input("VERSAO", db_1.sql.Int, nextVersion)
        .query("INSERT INTO dbo.TVIDEOS (ID, TRILHA_FK_ID, PATH_VIDEO, PROCEDIMENTO_ID, NORMA_ID, DURACAO_SEGUNDOS, ORDEM, VERSAO) VALUES (@ID, @TRILHA_FK_ID, @PATH_VIDEO, @PROCEDIMENTO_ID, @NORMA_ID, @DURACAO_SEGUNDOS, @ORDEM, @VERSAO)");
    // Ao criar nova versao, conclusoes antigas ficam arquivadas
    // e os usuarios precisam refazer este video.
    await (0, userTrainingModel_1.archiveVideoCompletionsByVideoId)(id);
    return getVideoById(id);
}
async function deleteVideo(id) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("DELETE FROM dbo.TVIDEOS WHERE ID = @ID");
}
async function setVideoOrder(id, ordem) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("ORDEM", db_1.sql.Int, ordem)
        .query("UPDATE dbo.TVIDEOS SET ORDEM = @ORDEM WHERE ID = @ID");
    if ((result.rowsAffected[0] ?? 0) === 0) {
        return undefined;
    }
    return getVideoById(id);
}
async function syncTrilhaVideosFromChannelVersion(previousPath, nextPath, duracaoSegundos, procedimentoId, normaId) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("PATH_VIDEO", db_1.sql.NVarChar(1000), previousPath)
        .query(`
      SELECT l.ID
      FROM (
        SELECT
          v.ID,
          v.PATH_VIDEO,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
      ) l
      WHERE l.RN = 1
        AND l.PATH_VIDEO = @PATH_VIDEO
    `);
    const ids = result.recordset.map((row) => String(row.ID));
    for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await updateVideo(id, {
            pathVideo: nextPath,
            duracaoSegundos: duracaoSegundos ?? undefined,
            procedimentoId,
            normaId,
        });
    }
    return ids.length;
}
