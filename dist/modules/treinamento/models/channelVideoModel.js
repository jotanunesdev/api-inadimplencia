"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listChannelVideoVersionsById = listChannelVideoVersionsById;
exports.listChannelVideos = listChannelVideos;
exports.getChannelVideoById = getChannelVideoById;
exports.createChannelVideo = createChannelVideo;
exports.updateChannelVideo = updateChannelVideo;
exports.deleteChannelVideo = deleteChannelVideo;
const db_1 = require("../config/db");
async function listChannelVideoVersionsById(id) {
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query(`
      SELECT ID, CANAL_FK_ID, PATH_VIDEO, TIPO_CONTEUDO, PROCEDIMENTO_ID, NORMA_ID, VERSAO, DURACAO_SEGUNDOS
      FROM dbo.TCANAL_VIDEOS
      WHERE ID = @ID
      ORDER BY VERSAO DESC
    `);
    return result.recordset;
}
async function listChannelVideos(canalId) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const conditions = [];
    if (canalId) {
        request.input("CANAL_FK_ID", db_1.sql.UniqueIdentifier, canalId);
        conditions.push("v.CANAL_FK_ID = @CANAL_FK_ID");
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await request.query(`
    SELECT ID, CANAL_FK_ID, PATH_VIDEO, TIPO_CONTEUDO, PROCEDIMENTO_ID, NORMA_ID, VERSAO, DURACAO_SEGUNDOS
    FROM (
      SELECT
        v.ID,
        v.CANAL_FK_ID,
        v.PATH_VIDEO,
        v.TIPO_CONTEUDO,
        v.PROCEDIMENTO_ID,
        v.NORMA_ID,
        v.VERSAO,
        v.DURACAO_SEGUNDOS,
        ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
      FROM dbo.TCANAL_VIDEOS v
      ${where}
    ) v
    WHERE v.RN = 1
  `);
    return result.recordset;
}
async function getChannelVideoById(id, versao) {
    const pool = await (0, db_1.getPool)();
    const request = pool.request().input("ID", db_1.sql.UniqueIdentifier, id);
    if (versao !== undefined) {
        request.input("VERSAO", db_1.sql.Int, versao);
        const result = await request.query("SELECT * FROM dbo.TCANAL_VIDEOS WHERE ID = @ID AND VERSAO = @VERSAO");
        return result.recordset[0];
    }
    const result = await request.query("SELECT TOP 1 * FROM dbo.TCANAL_VIDEOS WHERE ID = @ID ORDER BY VERSAO DESC");
    return result.recordset[0];
}
async function createChannelVideo(input) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.id)
        .input("CANAL_FK_ID", db_1.sql.UniqueIdentifier, input.canalId)
        .input("PATH_VIDEO", db_1.sql.NVarChar(1000), input.pathVideo)
        .input("TIPO_CONTEUDO", db_1.sql.VarChar(20), input.tipoConteudo ?? "video")
        .input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, input.procedimentoId ?? null)
        .input("NORMA_ID", db_1.sql.UniqueIdentifier, input.normaId ?? null)
        .input("DURACAO_SEGUNDOS", db_1.sql.Int, input.duracaoSegundos ?? 0)
        .input("VERSAO", db_1.sql.Int, 1)
        .query("INSERT INTO dbo.TCANAL_VIDEOS (ID, CANAL_FK_ID, PATH_VIDEO, TIPO_CONTEUDO, PROCEDIMENTO_ID, NORMA_ID, DURACAO_SEGUNDOS, VERSAO) VALUES (@ID, @CANAL_FK_ID, @PATH_VIDEO, @TIPO_CONTEUDO, @PROCEDIMENTO_ID, @NORMA_ID, @DURACAO_SEGUNDOS, @VERSAO)");
    return getChannelVideoById(input.id);
}
async function updateChannelVideo(id, input) {
    const pool = await (0, db_1.getPool)();
    const latestResult = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("SELECT TOP 1 * FROM dbo.TCANAL_VIDEOS WHERE ID = @ID ORDER BY VERSAO DESC");
    const latest = latestResult.recordset[0];
    if (!latest) {
        return undefined;
    }
    const nextVersion = (latest.VERSAO ?? 0) + 1;
    const canalId = input.canalId ?? latest.CANAL_FK_ID;
    const pathVideo = input.pathVideo ?? latest.PATH_VIDEO ?? "";
    const tipoConteudo = input.tipoConteudo ?? latest.TIPO_CONTEUDO ?? "video";
    const procedimentoId = input.procedimentoId !== undefined ? input.procedimentoId : latest.PROCEDIMENTO_ID;
    const normaId = input.normaId !== undefined ? input.normaId : latest.NORMA_ID;
    const duracaoSegundos = input.duracaoSegundos ?? latest.DURACAO_SEGUNDOS ?? 0;
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .input("CANAL_FK_ID", db_1.sql.UniqueIdentifier, canalId)
        .input("PATH_VIDEO", db_1.sql.NVarChar(1000), pathVideo)
        .input("TIPO_CONTEUDO", db_1.sql.VarChar(20), tipoConteudo)
        .input("PROCEDIMENTO_ID", db_1.sql.UniqueIdentifier, procedimentoId ?? null)
        .input("NORMA_ID", db_1.sql.UniqueIdentifier, normaId ?? null)
        .input("DURACAO_SEGUNDOS", db_1.sql.Int, duracaoSegundos)
        .input("VERSAO", db_1.sql.Int, nextVersion)
        .query("INSERT INTO dbo.TCANAL_VIDEOS (ID, CANAL_FK_ID, PATH_VIDEO, TIPO_CONTEUDO, PROCEDIMENTO_ID, NORMA_ID, DURACAO_SEGUNDOS, VERSAO) VALUES (@ID, @CANAL_FK_ID, @PATH_VIDEO, @TIPO_CONTEUDO, @PROCEDIMENTO_ID, @NORMA_ID, @DURACAO_SEGUNDOS, @VERSAO)");
    return getChannelVideoById(id);
}
async function deleteChannelVideo(id) {
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, id)
        .query("DELETE FROM dbo.TCANAL_VIDEOS WHERE ID = @ID");
}
