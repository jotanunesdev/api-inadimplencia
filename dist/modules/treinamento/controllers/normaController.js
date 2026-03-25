"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.updateUpload = exports.update = exports.createUpload = exports.create = exports.downloadContent = exports.getById = exports.list = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normaModel_1 = require("../models/normaModel");
const userTrainingModel_1 = require("../models/userTrainingModel");
const storage_1 = require("../utils/storage");
const sharePointService_1 = require("../services/sharePointService");
function parseOptionalVersion(raw) {
    if (raw === undefined || raw === null || String(raw).trim() === "") {
        return undefined;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new httpError_1.HttpError(400, "versao invalida");
    }
    return Math.trunc(parsed);
}
function parseOptionalObservacoes(raw) {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    const normalized = String(raw).trim();
    return normalized ? normalized : null;
}
function parseOptionalValidityPart(raw, min, max, field) {
    if (raw === undefined || raw === null || String(raw).trim() === "") {
        return undefined;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max || !Number.isInteger(parsed)) {
        throw new httpError_1.HttpError(400, `${field} invalido`);
    }
    return parsed;
}
function parseNormaValidity(rawMeses, rawAnos, fallback) {
    const parsedMeses = parseOptionalValidityPart(rawMeses, 0, 11, "validadeMeses");
    const parsedAnos = parseOptionalValidityPart(rawAnos, 0, 5, "validadeAnos");
    const validadeMeses = parsedMeses ?? fallback?.validadeMeses ?? 0;
    const validadeAnos = parsedAnos ?? fallback?.validadeAnos ?? 0;
    if (validadeMeses <= 0 && validadeAnos <= 0) {
        throw new httpError_1.HttpError(400, "Informe a validade da norma: meses (1-11), anos (1-5) ou ambos");
    }
    return { validadeMeses, validadeAnos };
}
function validatePdfFile(file) {
    if (!file) {
        throw new httpError_1.HttpError(400, "Arquivo PDF e obrigatorio");
    }
    const extension = path_1.default.extname(file.originalname || "").toLowerCase();
    if (extension !== ".pdf") {
        throw new httpError_1.HttpError(400, "Apenas arquivos .pdf sao permitidos");
    }
    return file;
}
async function resolveNormaFolder() {
    const folder = (0, storage_1.buildNormaRelativePath)();
    if ((0, sharePointService_1.isSharePointEnabled)()) {
        await (0, sharePointService_1.ensureSharePointFolder)(folder);
    }
    else {
        await (0, storage_1.ensurePublicDir)(folder);
    }
    return folder;
}
function buildNormaFileName(nome, originalName, versao) {
    const ext = path_1.default.extname(originalName || "").toLowerCase() || ".pdf";
    const base = (0, storage_1.sanitizeSegment)(nome).replace(/\s+/g, "-").toLowerCase() || "norma";
    return `${base}-v${versao}${ext}`;
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
exports.list = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const normas = await (0, normaModel_1.listNormas)();
    res.json({ normas });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const versao = parseOptionalVersion(req.query.versao);
    const norma = await (0, normaModel_1.getNormaById)(req.params.id, versao);
    if (!norma) {
        throw new httpError_1.HttpError(404, "Norma nao encontrada");
    }
    res.json({ norma });
});
exports.downloadContent = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const versao = parseOptionalVersion(req.query.versao);
    const norma = await (0, normaModel_1.getNormaById)(req.params.id, versao);
    if (!norma) {
        throw new httpError_1.HttpError(404, "Norma nao encontrada");
    }
    const rawPath = norma.PATH_PDF?.trim();
    if (!rawPath) {
        throw new httpError_1.HttpError(404, "Arquivo PDF da norma nao encontrado");
    }
    let buffer;
    if (rawPath.startsWith("http")) {
        buffer = await (0, sharePointService_1.downloadSharePointFileByUrl)(rawPath);
    }
    else {
        const localPath = (0, storage_1.toFsPath)(rawPath);
        try {
            buffer = await promises_1.default.readFile(localPath);
        }
        catch (error) {
            const err = error;
            if (err.code === "ENOENT") {
                throw new httpError_1.HttpError(404, "Arquivo PDF da norma nao encontrado");
            }
            throw error;
        }
    }
    const safeName = (0, storage_1.sanitizeSegment)(norma.NOME || `norma-${norma.ID}`).replace(/\s+/g, "-");
    const fileName = `${safeName || "norma"}-v${norma.VERSAO ?? 1}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${fileName}\"`);
    res.send(buffer);
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, nome, pathPdf, versao, validadeMeses, validadeAnos, observacoes } = req.body;
    const trimmedName = nome?.trim();
    const trimmedPath = pathPdf?.trim();
    if (!trimmedName || !trimmedPath) {
        throw new httpError_1.HttpError(400, "nome e pathPdf sao obrigatorios");
    }
    const validade = parseNormaValidity(validadeMeses, validadeAnos);
    const created = await (0, normaModel_1.createNorma)({
        id: id?.trim() || (0, crypto_1.randomUUID)(),
        nome: trimmedName,
        pathPdf: trimmedPath,
        observacoes: parseOptionalObservacoes(observacoes),
        versao: parseOptionalVersion(versao),
        validadeMeses: validade.validadeMeses,
        validadeAnos: validade.validadeAnos,
        alteradoEm: new Date(),
    });
    res.status(201).json({ norma: created });
});
exports.createUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, nome, versao, validadeMeses, validadeAnos, observacoes } = req.body;
    const trimmedName = nome?.trim();
    if (!trimmedName) {
        throw new httpError_1.HttpError(400, "nome e obrigatorio");
    }
    const parsedVersion = parseOptionalVersion(versao) ?? 1;
    const validade = parseNormaValidity(validadeMeses, validadeAnos);
    const file = validatePdfFile(req.file);
    const folder = await resolveNormaFolder();
    const fileName = buildNormaFileName(trimmedName, file.originalname, parsedVersion);
    let storedPath = "";
    if ((0, sharePointService_1.isSharePointEnabled)()) {
        const uploaded = await (0, sharePointService_1.uploadFileToSharePoint)({
            tempFilePath: file.path,
            relativeFolderPath: folder,
            fileName,
            contentType: file.mimetype,
        });
        storedPath = uploaded.webUrl;
    }
    else {
        const relativePath = [folder, fileName].filter(Boolean).join("/");
        const destPath = (0, storage_1.toFsPath)(relativePath);
        await (0, storage_1.moveFile)(file.path, destPath);
        storedPath = relativePath;
    }
    const created = await (0, normaModel_1.createNorma)({
        id: id?.trim() || (0, crypto_1.randomUUID)(),
        nome: trimmedName,
        pathPdf: storedPath,
        observacoes: parseOptionalObservacoes(observacoes),
        versao: parsedVersion,
        validadeMeses: validade.validadeMeses,
        validadeAnos: validade.validadeAnos,
        alteradoEm: new Date(),
    });
    res.status(201).json({ norma: created });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { nome, pathPdf, versao, validadeMeses, validadeAnos, observacoes } = req.body;
    if (nome === undefined &&
        pathPdf === undefined &&
        versao === undefined &&
        observacoes === undefined &&
        validadeMeses === undefined &&
        validadeAnos === undefined) {
        throw new httpError_1.HttpError(400, "Informe ao menos um campo para atualizar");
    }
    const latest = await (0, normaModel_1.getNormaById)(req.params.id);
    if (!latest) {
        throw new httpError_1.HttpError(404, "Norma nao encontrada");
    }
    const validade = parseNormaValidity(validadeMeses, validadeAnos, {
        validadeMeses: latest.VALIDADE_MESES ?? 0,
        validadeAnos: latest.VALIDADE_ANOS ?? 0,
    });
    const norma = await (0, normaModel_1.updateNorma)(req.params.id, {
        nome: nome?.trim() || undefined,
        pathPdf: pathPdf?.trim() || undefined,
        observacoes: parseOptionalObservacoes(observacoes),
        versao: parseOptionalVersion(versao),
        validadeMeses: validade.validadeMeses,
        validadeAnos: validade.validadeAnos,
        alteradoEm: new Date(),
    });
    if (!norma) {
        throw new httpError_1.HttpError(404, "Norma nao encontrada");
    }
    await (0, userTrainingModel_1.archiveTrainingsByNormaId)(req.params.id);
    res.json({ norma });
});
exports.updateUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const latest = await (0, normaModel_1.getNormaById)(req.params.id);
    if (!latest) {
        throw new httpError_1.HttpError(404, "Norma nao encontrada");
    }
    const { nome, versao, validadeMeses, validadeAnos, observacoes } = req.body;
    const file = validatePdfFile(req.file);
    const parsedVersion = parseOptionalVersion(versao);
    const nextVersion = parsedVersion !== undefined
        ? Math.max(parsedVersion, (latest.VERSAO ?? 0) + 1)
        : (latest.VERSAO ?? 0) + 1;
    const nextName = nome?.trim() || latest.NOME;
    const validade = parseNormaValidity(validadeMeses, validadeAnos, {
        validadeMeses: latest.VALIDADE_MESES ?? 0,
        validadeAnos: latest.VALIDADE_ANOS ?? 0,
    });
    const folder = await resolveNormaFolder();
    const fileName = buildNormaFileName(nextName, file.originalname, nextVersion);
    let storedPath = "";
    if ((0, sharePointService_1.isSharePointEnabled)()) {
        const uploaded = await (0, sharePointService_1.uploadFileToSharePoint)({
            tempFilePath: file.path,
            relativeFolderPath: folder,
            fileName,
            contentType: file.mimetype,
        });
        storedPath = uploaded.webUrl;
    }
    else {
        const relativePath = [folder, fileName].filter(Boolean).join("/");
        const destPath = (0, storage_1.toFsPath)(relativePath);
        await (0, storage_1.moveFile)(file.path, destPath);
        storedPath = relativePath;
    }
    const norma = await (0, normaModel_1.updateNorma)(req.params.id, {
        nome: nextName,
        pathPdf: storedPath,
        observacoes: parseOptionalObservacoes(observacoes),
        versao: nextVersion,
        validadeMeses: validade.validadeMeses,
        validadeAnos: validade.validadeAnos,
        alteradoEm: new Date(),
    });
    if (!norma) {
        throw new httpError_1.HttpError(404, "Norma nao encontrada");
    }
    await (0, userTrainingModel_1.archiveTrainingsByNormaId)(req.params.id);
    res.json({ norma });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const versions = await (0, normaModel_1.listNormaVersionsById)(req.params.id);
    await (0, normaModel_1.deleteNorma)(req.params.id);
    for (const version of versions) {
        if (!version.PATH_PDF)
            continue;
        if ((0, sharePointService_1.isSharePointEnabled)()) {
            // eslint-disable-next-line no-await-in-loop
            await (0, sharePointService_1.deleteSharePointFileByUrl)(version.PATH_PDF).catch(() => undefined);
        }
        else {
            // eslint-disable-next-line no-await-in-loop
            await removeLocalFileIfExists(version.PATH_PDF).catch(() => undefined);
        }
    }
    res.status(204).send();
});
