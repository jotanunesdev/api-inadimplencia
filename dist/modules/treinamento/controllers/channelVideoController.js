"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.completeSharePointUploadSession = exports.initSharePointUploadSession = exports.update = exports.updateUpload = exports.createUpload = exports.create = exports.getById = exports.list = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const channelVideoModel_1 = require("../models/channelVideoModel");
const videoModel_1 = require("../models/videoModel");
const channelModel_1 = require("../models/channelModel");
const storage_1 = require("../utils/storage");
const videoDuration_1 = require("../utils/videoDuration");
const sharePointService_1 = require("../services/sharePointService");
const pendingSharePointUploads = new Map();
const PENDING_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;
function createSessionId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}
function parseOptionalDuration(raw) {
    if (raw === undefined || raw === null || raw === "") {
        return undefined;
    }
    const duration = Number(raw);
    if (!Number.isFinite(duration) || duration < 0) {
        throw new httpError_1.HttpError(400, "duracaoSegundos invalida");
    }
    return duration;
}
function parseTipoConteudo(raw) {
    const normalized = String(raw ?? "video").trim().toLowerCase();
    if (normalized === "video" || normalized === "pdf") {
        return normalized;
    }
    throw new httpError_1.HttpError(400, "tipoConteudo invalido");
}
function parseOptionalUuid(raw) {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    const normalized = String(raw).trim();
    return normalized ? normalized : null;
}
function parseRequiredUploadedContent(params) {
    const { file, tipoConteudo } = params;
    if (!file) {
        throw new httpError_1.HttpError(400, tipoConteudo === "pdf" ? "Arquivo PDF e obrigatorio" : "Arquivo de video e obrigatorio");
    }
    const extension = path_1.default.extname(file.originalname || "").toLowerCase();
    if (tipoConteudo === "pdf") {
        if (extension !== ".pdf") {
            throw new httpError_1.HttpError(400, "Apenas arquivos .pdf sao permitidos");
        }
        return;
    }
    if (extension === ".pdf") {
        throw new httpError_1.HttpError(400, "Para PDF, selecione o tipoConteudo='pdf'");
    }
}
function cleanupPendingSharePointUploads() {
    const now = Date.now();
    for (const [key, pending] of pendingSharePointUploads.entries()) {
        if (now - pending.createdAt > PENDING_UPLOAD_TTL_MS) {
            pendingSharePointUploads.delete(key);
        }
    }
}
async function resolveChannelPath(canalId) {
    const channel = await (0, channelModel_1.getChannelById)(canalId);
    if (!channel) {
        throw new httpError_1.HttpError(404, "Canal nao encontrado");
    }
    if (channel.PATH) {
        if ((0, sharePointService_1.isSharePointEnabled)()) {
            await (0, sharePointService_1.ensureSharePointFolder)(channel.PATH);
        }
        else {
            await (0, storage_1.ensurePublicDir)(channel.PATH);
        }
        return { channel, channelPath: channel.PATH };
    }
    const channelPath = (0, storage_1.buildChannelRelativePath)(channel.NOME);
    if ((0, sharePointService_1.isSharePointEnabled)()) {
        await (0, sharePointService_1.ensureSharePointFolder)(channelPath);
    }
    else {
        await (0, storage_1.ensurePublicDir)(channelPath);
    }
    await (0, channelModel_1.updateChannel)(channel.ID, { path: channelPath });
    return { channel, channelPath };
}
function buildVersionedChannelFileName(originalName, version, tipoConteudo) {
    const ext = path_1.default.extname(originalName || "").toLowerCase() || ".mp4";
    const baseRaw = path_1.default.basename(originalName || "video", ext);
    const fallback = tipoConteudo === "pdf" ? "pdf" : "video";
    const base = (0, storage_1.sanitizeSegment)(baseRaw).replace(/\s+/g, "-").toLowerCase() || fallback;
    return `${base}${version}${ext}`;
}
async function removeLocalFileIfExists(storedPath) {
    if (!storedPath || storedPath.startsWith("http")) {
        return;
    }
    const fsPath = (0, storage_1.toFsPath)(storedPath);
    await promises_1.default.unlink(fsPath).catch((error) => {
        const err = error;
        if (err.code !== "ENOENT") {
            throw err;
        }
    });
}
exports.list = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { canalId } = req.query;
    if (!canalId) {
        throw new httpError_1.HttpError(400, "canalId e obrigatorio");
    }
    const videos = await (0, channelVideoModel_1.listChannelVideos)(canalId);
    res.json({ videos });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { versao } = req.query;
    const parsedVersion = versao !== undefined && versao !== "" ? Number(versao) : undefined;
    if (parsedVersion !== undefined && Number.isNaN(parsedVersion)) {
        throw new httpError_1.HttpError(400, "versao deve ser um numero");
    }
    const video = await (0, channelVideoModel_1.getChannelVideoById)(req.params.id, parsedVersion);
    if (!video) {
        throw new httpError_1.HttpError(404, "Video nao encontrado");
    }
    res.json({ video });
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, canalId, pathVideo, duracaoSegundos, tipoConteudo, procedimentoId, normaId } = req.body;
    if (!id || !canalId || !pathVideo) {
        throw new httpError_1.HttpError(400, "ID, canalId e pathVideo sao obrigatorios");
    }
    const duration = duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined;
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
        throw new httpError_1.HttpError(400, "duracaoSegundos invalida");
    }
    const normalizedTipo = parseTipoConteudo(tipoConteudo);
    const video = await (0, channelVideoModel_1.createChannelVideo)({
        id,
        canalId,
        pathVideo,
        tipoConteudo: normalizedTipo,
        procedimentoId: parseOptionalUuid(procedimentoId),
        normaId: parseOptionalUuid(normaId),
        duracaoSegundos: duration,
    });
    res.status(201).json({ video });
});
exports.createUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, canalId, duracaoSegundos, tipoConteudo, procedimentoId, normaId } = req.body;
    const file = req.file;
    if (!id || !canalId) {
        throw new httpError_1.HttpError(400, "ID e canalId sao obrigatorios");
    }
    const normalizedTipo = parseTipoConteudo(tipoConteudo);
    parseRequiredUploadedContent({ file, tipoConteudo: normalizedTipo });
    let duration = duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined;
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
        throw new httpError_1.HttpError(400, "duracaoSegundos invalida");
    }
    if (normalizedTipo === "video" && duration === undefined) {
        const probed = await (0, videoDuration_1.getVideoDurationSeconds)(file.path);
        if (probed === null) {
            throw new httpError_1.HttpError(422, "Nao foi possivel identificar a duracao do video");
        }
        duration = probed;
    }
    if (normalizedTipo === "pdf") {
        duration = 0;
    }
    const { channelPath } = await resolveChannelPath(canalId);
    const fileName = buildVersionedChannelFileName(file.originalname, 1, normalizedTipo);
    let storedPath = "";
    if ((0, sharePointService_1.isSharePointEnabled)()) {
        const uploaded = await (0, sharePointService_1.uploadFileToSharePoint)({
            tempFilePath: file.path,
            relativeFolderPath: channelPath,
            fileName,
            contentType: file.mimetype,
        });
        storedPath = uploaded.webUrl;
    }
    else {
        const relativePath = [channelPath, fileName].filter(Boolean).join("/");
        const destPath = (0, storage_1.toFsPath)(relativePath);
        await (0, storage_1.moveFile)(file.path, destPath);
        storedPath = relativePath;
    }
    const video = await (0, channelVideoModel_1.createChannelVideo)({
        id,
        canalId,
        pathVideo: storedPath,
        tipoConteudo: normalizedTipo,
        procedimentoId: parseOptionalUuid(procedimentoId),
        normaId: parseOptionalUuid(normaId),
        duracaoSegundos: duration,
    });
    res.status(201).json({ video });
});
exports.updateUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { canalId, duracaoSegundos, tipoConteudo, procedimentoId, normaId } = req.body;
    const file = req.file;
    const latestBeforeUpdate = await (0, channelVideoModel_1.getChannelVideoById)(req.params.id);
    if (!latestBeforeUpdate) {
        throw new httpError_1.HttpError(404, "Video nao encontrado");
    }
    const normalizedTipo = parseTipoConteudo(tipoConteudo ?? latestBeforeUpdate.TIPO_CONTEUDO);
    parseRequiredUploadedContent({ file, tipoConteudo: normalizedTipo });
    const resolvedCanalId = canalId ?? latestBeforeUpdate?.CANAL_FK_ID;
    if (!resolvedCanalId) {
        throw new httpError_1.HttpError(400, "canalId e obrigatorio");
    }
    let duration = duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined;
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
        throw new httpError_1.HttpError(400, "duracaoSegundos invalida");
    }
    if (normalizedTipo === "video" && duration === undefined) {
        const probed = await (0, videoDuration_1.getVideoDurationSeconds)(file.path);
        if (probed === null) {
            throw new httpError_1.HttpError(422, "Nao foi possivel identificar a duracao do video");
        }
        duration = probed;
    }
    if (normalizedTipo === "pdf") {
        duration = 0;
    }
    const { channelPath } = await resolveChannelPath(resolvedCanalId);
    const nextVersion = (latestBeforeUpdate?.VERSAO ?? 0) + 1;
    const fileName = buildVersionedChannelFileName(file.originalname, nextVersion, normalizedTipo);
    let storedPath = "";
    if ((0, sharePointService_1.isSharePointEnabled)()) {
        const uploaded = await (0, sharePointService_1.uploadFileToSharePoint)({
            tempFilePath: file.path,
            relativeFolderPath: channelPath,
            fileName,
            contentType: file.mimetype,
        });
        storedPath = uploaded.webUrl;
    }
    else {
        const relativePath = [channelPath, fileName].filter(Boolean).join("/");
        const destPath = (0, storage_1.toFsPath)(relativePath);
        await (0, storage_1.moveFile)(file.path, destPath);
        storedPath = relativePath;
    }
    const video = await (0, channelVideoModel_1.updateChannelVideo)(req.params.id, {
        canalId: resolvedCanalId,
        pathVideo: storedPath,
        tipoConteudo: normalizedTipo,
        procedimentoId: parseOptionalUuid(procedimentoId),
        normaId: parseOptionalUuid(normaId),
        duracaoSegundos: duration,
    });
    if (!video) {
        throw new httpError_1.HttpError(404, "Video nao encontrado");
    }
    if (normalizedTipo === "video" && latestBeforeUpdate?.PATH_VIDEO) {
        await (0, videoModel_1.syncTrilhaVideosFromChannelVersion)(latestBeforeUpdate.PATH_VIDEO, video.PATH_VIDEO ?? latestBeforeUpdate.PATH_VIDEO, video.DURACAO_SEGUNDOS ?? undefined, parseOptionalUuid(procedimentoId) ?? video.PROCEDIMENTO_ID ?? null, parseOptionalUuid(normaId) ?? video.NORMA_ID ?? null);
    }
    res.json({ video });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { canalId, pathVideo, duracaoSegundos, tipoConteudo, procedimentoId, normaId } = req.body;
    const trimmedPath = pathVideo?.trim();
    const latestBeforeUpdate = await (0, channelVideoModel_1.getChannelVideoById)(req.params.id);
    if (!latestBeforeUpdate) {
        throw new httpError_1.HttpError(404, "Video nao encontrado");
    }
    if (!trimmedPath &&
        canalId === undefined &&
        duracaoSegundos === undefined &&
        tipoConteudo === undefined &&
        procedimentoId === undefined &&
        normaId === undefined) {
        throw new httpError_1.HttpError(400, "Informe ao menos um campo para atualizar");
    }
    const resolvedCanalId = canalId ?? latestBeforeUpdate.CANAL_FK_ID;
    if (!resolvedCanalId) {
        throw new httpError_1.HttpError(400, "canalId e obrigatorio");
    }
    const duration = parseOptionalDuration(duracaoSegundos);
    const normalizedTipo = tipoConteudo !== undefined ? parseTipoConteudo(tipoConteudo) : undefined;
    const video = await (0, channelVideoModel_1.updateChannelVideo)(req.params.id, {
        canalId: resolvedCanalId,
        pathVideo: trimmedPath,
        tipoConteudo: normalizedTipo,
        procedimentoId: parseOptionalUuid(procedimentoId),
        normaId: parseOptionalUuid(normaId),
        duracaoSegundos: duration,
    });
    if (!video) {
        throw new httpError_1.HttpError(404, "Video nao encontrado");
    }
    if ((normalizedTipo ?? latestBeforeUpdate.TIPO_CONTEUDO ?? "video") === "video" && latestBeforeUpdate.PATH_VIDEO) {
        await (0, videoModel_1.syncTrilhaVideosFromChannelVersion)(latestBeforeUpdate.PATH_VIDEO, video.PATH_VIDEO ?? latestBeforeUpdate.PATH_VIDEO, video.DURACAO_SEGUNDOS ?? undefined, video.PROCEDIMENTO_ID ?? null, video.NORMA_ID ?? null);
    }
    res.json({ video });
});
exports.initSharePointUploadSession = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!(0, sharePointService_1.isSharePointEnabled)()) {
        throw new httpError_1.HttpError(400, "Upload em partes no SharePoint nao habilitado neste ambiente");
    }
    cleanupPendingSharePointUploads();
    const { mode, id, canalId, fileName, duracaoSegundos, tipoConteudo, procedimentoId, normaId } = req.body;
    if (!fileName?.trim()) {
        throw new httpError_1.HttpError(400, "fileName e obrigatorio");
    }
    const uploadMode = mode ?? "create";
    const duration = parseOptionalDuration(duracaoSegundos);
    const normalizedTipo = parseTipoConteudo(tipoConteudo);
    if (normalizedTipo === "pdf") {
        throw new httpError_1.HttpError(400, "Upload em partes para canal suporta apenas videos");
    }
    const sessionId = createSessionId();
    if (uploadMode === "create") {
        if (!id || !canalId) {
            throw new httpError_1.HttpError(400, "ID e canalId sao obrigatorios");
        }
        const { channelPath } = await resolveChannelPath(canalId);
        const uploadFileName = buildVersionedChannelFileName(fileName, 1, normalizedTipo);
        const session = await (0, sharePointService_1.createSharePointUploadSession)({
            relativeFolderPath: channelPath,
            fileName: uploadFileName,
        });
        pendingSharePointUploads.set(sessionId, {
            mode: "create",
            videoId: id,
            canalId,
            tipoConteudo: normalizedTipo,
            procedimentoId: parseOptionalUuid(procedimentoId) ?? null,
            normaId: parseOptionalUuid(normaId) ?? null,
            fullPath: session.fullPath,
            previousPath: null,
            duracaoSegundos: duration ?? null,
            createdAt: Date.now(),
        });
        res.status(201).json({
            sessionId,
            uploadUrl: session.uploadUrl,
            fileName: session.fileName,
        });
        return;
    }
    if (uploadMode === "update") {
        if (!id) {
            throw new httpError_1.HttpError(400, "ID e obrigatorio");
        }
        const latestBeforeUpdate = await (0, channelVideoModel_1.getChannelVideoById)(id);
        if (!latestBeforeUpdate) {
            throw new httpError_1.HttpError(404, "Video nao encontrado");
        }
        const resolvedCanalId = canalId ?? latestBeforeUpdate.CANAL_FK_ID;
        if (!resolvedCanalId) {
            throw new httpError_1.HttpError(400, "canalId e obrigatorio");
        }
        const { channelPath } = await resolveChannelPath(resolvedCanalId);
        const nextVersion = (latestBeforeUpdate.VERSAO ?? 0) + 1;
        const uploadFileName = buildVersionedChannelFileName(fileName, nextVersion, normalizedTipo);
        const session = await (0, sharePointService_1.createSharePointUploadSession)({
            relativeFolderPath: channelPath,
            fileName: uploadFileName,
        });
        pendingSharePointUploads.set(sessionId, {
            mode: "update",
            videoId: id,
            canalId: resolvedCanalId,
            tipoConteudo: normalizedTipo,
            procedimentoId: parseOptionalUuid(procedimentoId) ?? latestBeforeUpdate.PROCEDIMENTO_ID ?? null,
            normaId: parseOptionalUuid(normaId) ?? latestBeforeUpdate.NORMA_ID ?? null,
            fullPath: session.fullPath,
            previousPath: latestBeforeUpdate.PATH_VIDEO ?? null,
            duracaoSegundos: duration ?? null,
            createdAt: Date.now(),
        });
        res.status(201).json({
            sessionId,
            uploadUrl: session.uploadUrl,
            fileName: session.fileName,
        });
        return;
    }
    throw new httpError_1.HttpError(400, "mode deve ser 'create' ou 'update'");
});
exports.completeSharePointUploadSession = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!(0, sharePointService_1.isSharePointEnabled)()) {
        throw new httpError_1.HttpError(400, "Upload em partes no SharePoint nao habilitado neste ambiente");
    }
    cleanupPendingSharePointUploads();
    const pending = pendingSharePointUploads.get(req.params.sessionId);
    if (!pending) {
        throw new httpError_1.HttpError(404, "Sessao de upload nao encontrada ou expirada");
    }
    if (Date.now() - pending.createdAt > PENDING_UPLOAD_TTL_MS) {
        pendingSharePointUploads.delete(req.params.sessionId);
        throw new httpError_1.HttpError(410, "Sessao de upload expirada");
    }
    const requestedDuration = parseOptionalDuration(req.body?.duracaoSegundos);
    const duration = requestedDuration ?? pending.duracaoSegundos ?? 0;
    const uploadedFile = await (0, sharePointService_1.getSharePointFileByPath)(pending.fullPath);
    if (!uploadedFile.webUrl) {
        throw new httpError_1.HttpError(500, "Upload concluido sem webUrl do arquivo no SharePoint");
    }
    let video;
    if (pending.mode === "create") {
        video = await (0, channelVideoModel_1.createChannelVideo)({
            id: pending.videoId,
            canalId: pending.canalId,
            pathVideo: uploadedFile.webUrl,
            tipoConteudo: pending.tipoConteudo,
            procedimentoId: pending.procedimentoId,
            normaId: pending.normaId,
            duracaoSegundos: duration,
        });
    }
    else {
        video = await (0, channelVideoModel_1.updateChannelVideo)(pending.videoId, {
            canalId: pending.canalId,
            pathVideo: uploadedFile.webUrl,
            tipoConteudo: pending.tipoConteudo,
            procedimentoId: pending.procedimentoId,
            normaId: pending.normaId,
            duracaoSegundos: duration,
        });
        if (!video) {
            throw new httpError_1.HttpError(404, "Video nao encontrado");
        }
        if (pending.tipoConteudo === "video" && pending.previousPath) {
            await (0, videoModel_1.syncTrilhaVideosFromChannelVersion)(pending.previousPath, video.PATH_VIDEO ?? pending.previousPath, video.DURACAO_SEGUNDOS ?? undefined, video.PROCEDIMENTO_ID ?? null, video.NORMA_ID ?? null);
        }
    }
    pendingSharePointUploads.delete(req.params.sessionId);
    res.json({ video });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const versions = await (0, channelVideoModel_1.listChannelVideoVersionsById)(req.params.id);
    await (0, channelVideoModel_1.deleteChannelVideo)(req.params.id);
    for (const version of versions) {
        if (!version.PATH_VIDEO)
            continue;
        if ((0, sharePointService_1.isSharePointEnabled)()) {
            // eslint-disable-next-line no-await-in-loop
            await (0, sharePointService_1.deleteSharePointFileByUrl)(version.PATH_VIDEO).catch(() => undefined);
        }
        else {
            // eslint-disable-next-line no-await-in-loop
            await removeLocalFileIfExists(version.PATH_VIDEO).catch(() => undefined);
        }
    }
    res.status(204).send();
});
