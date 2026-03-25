"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrder = exports.remove = exports.updateUpload = exports.update = exports.createUpload = exports.create = exports.getById = exports.list = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const videoModel_1 = require("../models/videoModel");
const trilhaModel_1 = require("../models/trilhaModel");
const moduleModel_1 = require("../models/moduleModel");
const storage_1 = require("../utils/storage");
const videoDuration_1 = require("../utils/videoDuration");
const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function parseOptionalProcedimentoId(raw) {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    const value = String(raw).trim();
    if (!value) {
        return null;
    }
    if (!GUID_REGEX.test(value)) {
        throw new httpError_1.HttpError(400, "procedimentoId invalido");
    }
    return value;
}
function parseOptionalNormaId(raw) {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    const value = String(raw).trim();
    if (!value) {
        return null;
    }
    if (!GUID_REGEX.test(value)) {
        throw new httpError_1.HttpError(400, "normaId invalido");
    }
    return value;
}
async function resolveTrilhaPath(trilhaId) {
    const trilha = await (0, trilhaModel_1.getTrilhaById)(trilhaId);
    if (!trilha) {
        throw new httpError_1.HttpError(404, "Trilha nao encontrada");
    }
    if (trilha.PATH) {
        await (0, storage_1.ensurePublicDir)(trilha.PATH);
        return { trilha, trilhaPath: trilha.PATH };
    }
    const module = await (0, moduleModel_1.getModuleById)(trilha.MODULO_FK_ID);
    if (!module) {
        throw new httpError_1.HttpError(404, "Modulo nao encontrado");
    }
    const modulePath = module.PATH ?? (0, storage_1.buildModuleRelativePath)(module.NOME);
    await (0, storage_1.ensurePublicDir)(modulePath);
    const trilhaPath = (0, storage_1.buildTrilhaRelativePath)(modulePath, trilha.TITULO);
    await (0, storage_1.ensurePublicDir)(trilhaPath);
    await (0, trilhaModel_1.updateTrilha)(trilha.ID, { path: trilhaPath });
    return { trilha, trilhaPath };
}
exports.list = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId, cpf, includePdf } = req.query;
    const normalizedCpf = cpf ? (0, normalizeCpf_1.normalizeCpf)(cpf) : undefined;
    const includePdfFlag = includePdf === "true" || (includePdf === undefined && Boolean(normalizedCpf));
    const videos = await (0, videoModel_1.listVideos)(trilhaId, normalizedCpf, includePdfFlag);
    res.json({ videos });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { versao } = req.query;
    const parsedVersion = versao !== undefined && versao !== "" ? Number(versao) : undefined;
    if (parsedVersion !== undefined && Number.isNaN(parsedVersion)) {
        throw new httpError_1.HttpError(400, "versao deve ser um numero");
    }
    const video = await (0, videoModel_1.getVideoById)(req.params.id, parsedVersion);
    if (!video) {
        throw new httpError_1.HttpError(404, "Video nao encontrado");
    }
    res.json({ video });
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, trilhaId, pathVideo, duracaoSegundos, ordem, procedimentoId, normaId } = req.body;
    if (!id || !trilhaId || !pathVideo) {
        throw new httpError_1.HttpError(400, "ID, trilhaId e pathVideo sao obrigatorios");
    }
    const duration = duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined;
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
        throw new httpError_1.HttpError(400, "duracaoSegundos invalida");
    }
    const order = ordem !== undefined ? Number(ordem) : undefined;
    if (order !== undefined && (!Number.isFinite(order) || order <= 0)) {
        throw new httpError_1.HttpError(400, "ordem invalida");
    }
    const procedimento = parseOptionalProcedimentoId(procedimentoId);
    const norma = parseOptionalNormaId(normaId);
    const video = await (0, videoModel_1.createVideo)({
        id,
        trilhaId,
        pathVideo,
        procedimentoId: procedimento,
        normaId: norma,
        duracaoSegundos: duration,
        ordem: order,
    });
    res.status(201).json({ video });
});
exports.createUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, trilhaId, duracaoSegundos, ordem, procedimentoId, normaId } = req.body;
    const file = req.file;
    if (!id || !trilhaId) {
        throw new httpError_1.HttpError(400, "ID e trilhaId sao obrigatorios");
    }
    if (!file) {
        throw new httpError_1.HttpError(400, "Arquivo de video e obrigatorio");
    }
    const { trilhaPath } = await resolveTrilhaPath(trilhaId);
    const fileName = (0, storage_1.buildStoredFileName)(file.originalname, "video");
    const relativePath = [trilhaPath, fileName].filter(Boolean).join("/");
    const destPath = (0, storage_1.toFsPath)(relativePath);
    await (0, storage_1.moveFile)(file.path, destPath);
    let duration = duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined;
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
        throw new httpError_1.HttpError(400, "duracaoSegundos invalida");
    }
    const order = ordem !== undefined ? Number(ordem) : undefined;
    if (order !== undefined && (!Number.isFinite(order) || order <= 0)) {
        throw new httpError_1.HttpError(400, "ordem invalida");
    }
    const procedimento = parseOptionalProcedimentoId(procedimentoId);
    const norma = parseOptionalNormaId(normaId);
    if (duration === undefined) {
        const probed = await (0, videoDuration_1.getVideoDurationSeconds)(destPath);
        if (probed === null) {
            throw new httpError_1.HttpError(422, "Nao foi possivel identificar a duracao do video");
        }
        duration = probed;
    }
    const video = await (0, videoModel_1.createVideo)({
        id,
        trilhaId,
        pathVideo: relativePath,
        procedimentoId: procedimento,
        normaId: norma,
        duracaoSegundos: duration,
        ordem: order,
    });
    res.status(201).json({ video });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId, pathVideo, duracaoSegundos, ordem, procedimentoId, normaId } = req.body;
    if (!pathVideo &&
        duracaoSegundos === undefined &&
        ordem === undefined &&
        procedimentoId === undefined &&
        normaId === undefined) {
        throw new httpError_1.HttpError(400, "pathVideo, duracaoSegundos, ordem, procedimentoId ou normaId e obrigatorio");
    }
    const duration = duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined;
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
        throw new httpError_1.HttpError(400, "duracaoSegundos invalida");
    }
    const order = ordem !== undefined ? Number(ordem) : undefined;
    if (order !== undefined && (!Number.isFinite(order) || order <= 0)) {
        throw new httpError_1.HttpError(400, "ordem invalida");
    }
    const procedimento = parseOptionalProcedimentoId(procedimentoId);
    const norma = parseOptionalNormaId(normaId);
    const video = await (0, videoModel_1.updateVideo)(req.params.id, {
        trilhaId,
        pathVideo,
        procedimentoId: procedimento,
        normaId: norma,
        duracaoSegundos: duration,
        ordem: order,
    });
    if (!video) {
        throw new httpError_1.HttpError(404, "Video nao encontrado");
    }
    res.json({ video });
});
exports.updateUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId, duracaoSegundos, procedimentoId, normaId } = req.body;
    const file = req.file;
    if (!file) {
        throw new httpError_1.HttpError(400, "Arquivo de video e obrigatorio");
    }
    const resolvedTrilhaId = trilhaId ?? (await (0, videoModel_1.getVideoById)(req.params.id))?.TRILHA_FK_ID;
    if (!resolvedTrilhaId) {
        throw new httpError_1.HttpError(400, "trilhaId e obrigatorio");
    }
    const { trilhaPath } = await resolveTrilhaPath(resolvedTrilhaId);
    const fileName = (0, storage_1.buildStoredFileName)(file.originalname, "video");
    const relativePath = [trilhaPath, fileName].filter(Boolean).join("/");
    const destPath = (0, storage_1.toFsPath)(relativePath);
    await (0, storage_1.moveFile)(file.path, destPath);
    let duration = duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined;
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
        throw new httpError_1.HttpError(400, "duracaoSegundos invalida");
    }
    if (duration === undefined) {
        const probed = await (0, videoDuration_1.getVideoDurationSeconds)(destPath);
        if (probed === null) {
            throw new httpError_1.HttpError(422, "Nao foi possivel identificar a duracao do video");
        }
        duration = probed;
    }
    const procedimento = parseOptionalProcedimentoId(procedimentoId);
    const norma = parseOptionalNormaId(normaId);
    const video = await (0, videoModel_1.updateVideo)(req.params.id, {
        trilhaId: resolvedTrilhaId,
        pathVideo: relativePath,
        procedimentoId: procedimento,
        normaId: norma,
        duracaoSegundos: duration,
    });
    if (!video) {
        throw new httpError_1.HttpError(404, "Video nao encontrado");
    }
    res.json({ video });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    try {
        await (0, videoModel_1.deleteVideo)(req.params.id);
    }
    catch (error) {
        const requestError = error;
        const message = requestError?.originalError?.info?.message ?? requestError?.message ?? "";
        if (requestError?.number === 547) {
            throw new httpError_1.HttpError(409, "Nao e possivel excluir este video porque existem conclusoes, vinculos ou registros associados.");
        }
        if (message) {
            throw new httpError_1.HttpError(400, message);
        }
        throw error;
    }
    res.status(204).send();
});
exports.updateOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { ordem } = req.body;
    const order = Number(ordem);
    if (!Number.isFinite(order) || order <= 0) {
        throw new httpError_1.HttpError(400, "ordem invalida");
    }
    const video = await (0, videoModel_1.setVideoOrder)(req.params.id, order);
    if (!video) {
        throw new httpError_1.HttpError(404, "Video nao encontrado");
    }
    res.json({ video });
});
