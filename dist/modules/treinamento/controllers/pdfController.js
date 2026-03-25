"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.updateUpload = exports.update = exports.createUpload = exports.create = exports.getById = exports.list = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const pdfModel_1 = require("../models/pdfModel");
const trilhaModel_1 = require("../models/trilhaModel");
const moduleModel_1 = require("../models/moduleModel");
const storage_1 = require("../utils/storage");
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
    const { trilhaId, cpf } = req.query;
    const normalizedCpf = cpf ? (0, normalizeCpf_1.normalizeCpf)(cpf) : undefined;
    const pdfs = await (0, pdfModel_1.listPdfs)(trilhaId, normalizedCpf);
    res.json({ pdfs });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { versao } = req.query;
    const parsedVersion = versao !== undefined && versao !== "" ? Number(versao) : undefined;
    if (parsedVersion !== undefined && Number.isNaN(parsedVersion)) {
        throw new httpError_1.HttpError(400, "versao deve ser um numero");
    }
    const pdf = await (0, pdfModel_1.getPdfById)(req.params.id, parsedVersion);
    if (!pdf) {
        throw new httpError_1.HttpError(404, "PDF nao encontrado");
    }
    res.json({ pdf });
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, trilhaId, pdfPath, procedimentoId, normaId, ordem } = req.body;
    if (!id || !trilhaId || !pdfPath) {
        throw new httpError_1.HttpError(400, "ID, trilhaId e pdfPath sao obrigatorios");
    }
    const procedimento = parseOptionalProcedimentoId(procedimentoId);
    const norma = parseOptionalNormaId(normaId);
    const order = ordem !== undefined ? Number(ordem) : undefined;
    if (order !== undefined && (!Number.isFinite(order) || order <= 0)) {
        throw new httpError_1.HttpError(400, "ordem invalida");
    }
    const pdf = await (0, pdfModel_1.createPdf)({
        id,
        trilhaId,
        pdfPath,
        procedimentoId: procedimento,
        normaId: norma,
        ordem: order,
    });
    res.status(201).json({ pdf });
});
exports.createUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, trilhaId, procedimentoId, normaId } = req.body;
    const file = req.file;
    if (!id || !trilhaId) {
        throw new httpError_1.HttpError(400, "ID e trilhaId sao obrigatorios");
    }
    if (!file) {
        throw new httpError_1.HttpError(400, "Arquivo de PDF e obrigatorio");
    }
    const { trilhaPath } = await resolveTrilhaPath(trilhaId);
    const fileName = (0, storage_1.buildStoredFileName)(file.originalname, "pdf");
    const relativePath = [trilhaPath, fileName].filter(Boolean).join("/");
    const destPath = (0, storage_1.toFsPath)(relativePath);
    await (0, storage_1.moveFile)(file.path, destPath);
    const procedimento = parseOptionalProcedimentoId(procedimentoId);
    const norma = parseOptionalNormaId(normaId);
    const pdf = await (0, pdfModel_1.createPdf)({
        id,
        trilhaId,
        pdfPath: relativePath,
        procedimentoId: procedimento,
        normaId: norma,
    });
    res.status(201).json({ pdf });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId, pdfPath, procedimentoId, normaId, ordem } = req.body;
    if (!pdfPath &&
        procedimentoId === undefined &&
        normaId === undefined &&
        trilhaId === undefined) {
        throw new httpError_1.HttpError(400, "pdfPath, trilhaId, procedimentoId ou normaId e obrigatorio");
    }
    const procedimento = parseOptionalProcedimentoId(procedimentoId);
    const norma = parseOptionalNormaId(normaId);
    const order = ordem !== undefined ? Number(ordem) : undefined;
    if (order !== undefined && (!Number.isFinite(order) || order <= 0)) {
        throw new httpError_1.HttpError(400, "ordem invalida");
    }
    const pdf = await (0, pdfModel_1.updatePdf)(req.params.id, {
        trilhaId,
        pdfPath,
        procedimentoId: procedimento,
        normaId: norma,
        ordem: order,
    });
    if (!pdf) {
        throw new httpError_1.HttpError(404, "PDF nao encontrado");
    }
    res.json({ pdf });
});
exports.updateUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId, procedimentoId, normaId } = req.body;
    const file = req.file;
    if (!file) {
        throw new httpError_1.HttpError(400, "Arquivo de PDF e obrigatorio");
    }
    const resolvedTrilhaId = trilhaId ?? (await (0, pdfModel_1.getPdfById)(req.params.id))?.TRILHA_FK_ID;
    if (!resolvedTrilhaId) {
        throw new httpError_1.HttpError(400, "trilhaId e obrigatorio");
    }
    const { trilhaPath } = await resolveTrilhaPath(resolvedTrilhaId);
    const fileName = (0, storage_1.buildStoredFileName)(file.originalname, "pdf");
    const relativePath = [trilhaPath, fileName].filter(Boolean).join("/");
    const destPath = (0, storage_1.toFsPath)(relativePath);
    await (0, storage_1.moveFile)(file.path, destPath);
    const procedimento = parseOptionalProcedimentoId(procedimentoId);
    const norma = parseOptionalNormaId(normaId);
    const pdf = await (0, pdfModel_1.updatePdf)(req.params.id, {
        trilhaId: resolvedTrilhaId,
        pdfPath: relativePath,
        procedimentoId: procedimento,
        normaId: norma,
    });
    if (!pdf) {
        throw new httpError_1.HttpError(404, "PDF nao encontrado");
    }
    res.json({ pdf });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    try {
        await (0, pdfModel_1.deletePdf)(req.params.id);
    }
    catch (error) {
        const requestError = error;
        const message = requestError?.originalError?.info?.message ?? requestError?.message ?? "";
        if (requestError?.number === 547) {
            throw new httpError_1.HttpError(409, "Nao e possivel excluir este PDF porque existem conclusoes, vinculos ou registros associados.");
        }
        if (message) {
            throw new httpError_1.HttpError(400, message);
        }
        throw error;
    }
    res.status(204).send();
});
