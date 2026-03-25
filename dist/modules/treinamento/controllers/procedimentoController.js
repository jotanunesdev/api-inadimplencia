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
const procedimentoModel_1 = require("../models/procedimentoModel");
const procedimentoProvaModel_1 = require("../models/procedimentoProvaModel");
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
function parseProcedimentoProvaQuestoes(raw) {
    let normalizedRaw = raw;
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed) {
            throw new httpError_1.HttpError(400, "Informe ao menos uma questao para a prova do procedimento.");
        }
        try {
            normalizedRaw = JSON.parse(trimmed);
        }
        catch {
            throw new httpError_1.HttpError(400, "Formato invalido para provaQuestoes. Envie um JSON valido.");
        }
    }
    if (!Array.isArray(normalizedRaw) || normalizedRaw.length === 0) {
        throw new httpError_1.HttpError(400, "Informe ao menos uma questao para a prova do procedimento.");
    }
    return normalizedRaw.map((question, questionIndex) => {
        const payload = question;
        const enunciado = String(payload?.enunciado ?? "").trim();
        if (!enunciado) {
            throw new httpError_1.HttpError(400, `Questao ${questionIndex + 1}: enunciado obrigatorio.`);
        }
        const pesoRaw = Number(payload?.peso ?? 1);
        if (!Number.isFinite(pesoRaw) || pesoRaw <= 0) {
            throw new httpError_1.HttpError(400, `Questao ${questionIndex + 1}: peso invalido.`);
        }
        if (!Array.isArray(payload?.opcoes) || payload.opcoes.length < 2) {
            throw new httpError_1.HttpError(400, `Questao ${questionIndex + 1}: inclua ao menos duas opcoes.`);
        }
        const opcoes = payload.opcoes.map((option, optionIndex) => {
            const texto = String(option?.texto ?? "").trim();
            if (!texto) {
                throw new httpError_1.HttpError(400, `Questao ${questionIndex + 1}, opcao ${optionIndex + 1}: texto obrigatorio.`);
            }
            return {
                texto,
                correta: Boolean(option?.correta),
            };
        });
        const correctCount = opcoes.filter((option) => option.correta).length;
        if (correctCount !== 1) {
            throw new httpError_1.HttpError(400, `Questao ${questionIndex + 1}: deve existir exatamente uma opcao correta.`);
        }
        return {
            enunciado,
            peso: Math.round(pesoRaw * 10000) / 10000,
            opcoes,
        };
    });
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
async function resolveProcedureFolder() {
    const folder = (0, storage_1.buildProcedureRelativePath)();
    if ((0, sharePointService_1.isSharePointEnabled)()) {
        await (0, sharePointService_1.ensureSharePointFolder)(folder);
    }
    else {
        await (0, storage_1.ensurePublicDir)(folder);
    }
    return folder;
}
function buildProcedureFileName(nome, originalName, versao) {
    const ext = path_1.default.extname(originalName || "").toLowerCase() || ".pdf";
    const base = (0, storage_1.sanitizeSegment)(nome).replace(/\s+/g, "-").toLowerCase() || "procedimento";
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
    const procedimentos = await (0, procedimentoModel_1.listProcedimentos)();
    res.json({ procedimentos });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const versao = parseOptionalVersion(req.query.versao);
    const procedimento = await (0, procedimentoModel_1.getProcedimentoById)(req.params.id, versao);
    if (!procedimento) {
        throw new httpError_1.HttpError(404, "Procedimento nao encontrado");
    }
    res.json({ procedimento });
});
exports.downloadContent = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const versao = parseOptionalVersion(req.query.versao);
    const procedimento = await (0, procedimentoModel_1.getProcedimentoById)(req.params.id, versao);
    if (!procedimento) {
        throw new httpError_1.HttpError(404, "Procedimento nao encontrado");
    }
    const rawPath = procedimento.PATH_PDF?.trim();
    if (!rawPath) {
        throw new httpError_1.HttpError(404, "Arquivo PDF do procedimento nao encontrado");
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
                throw new httpError_1.HttpError(404, "Arquivo PDF do procedimento nao encontrado");
            }
            throw error;
        }
    }
    const safeName = (0, storage_1.sanitizeSegment)(procedimento.NOME || `procedimento-${procedimento.ID}`).replace(/\s+/g, "-");
    const fileName = `${safeName || "procedimento"}-v${procedimento.VERSAO ?? 1}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${fileName}\"`);
    res.send(buffer);
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, nome, pathPdf, versao, observacoes, provaQuestoes } = req.body;
    const trimmedName = nome?.trim();
    const trimmedPath = pathPdf?.trim();
    if (!trimmedName || !trimmedPath) {
        throw new httpError_1.HttpError(400, "nome e pathPdf sao obrigatorios");
    }
    const normalizedQuestoes = parseProcedimentoProvaQuestoes(provaQuestoes);
    const created = await (0, procedimentoModel_1.createProcedimento)({
        id: id?.trim() || (0, crypto_1.randomUUID)(),
        nome: trimmedName,
        pathPdf: trimmedPath,
        observacoes: parseOptionalObservacoes(observacoes),
        versao: parseOptionalVersion(versao),
        alteradoEm: new Date(),
    });
    if (!created) {
        throw new httpError_1.HttpError(500, "Nao foi possivel criar o procedimento.");
    }
    await (0, procedimentoProvaModel_1.replaceProcedimentoProvaQuestoes)(created.ID, created.VERSAO ?? parseOptionalVersion(versao) ?? 1, normalizedQuestoes);
    res.status(201).json({ procedimento: created });
});
exports.createUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, nome, versao, observacoes, provaQuestoes } = req.body;
    const trimmedName = nome?.trim();
    if (!trimmedName) {
        throw new httpError_1.HttpError(400, "nome e obrigatorio");
    }
    const normalizedQuestoes = parseProcedimentoProvaQuestoes(provaQuestoes);
    const parsedVersion = parseOptionalVersion(versao) ?? 1;
    const file = validatePdfFile(req.file);
    const folder = await resolveProcedureFolder();
    const fileName = buildProcedureFileName(trimmedName, file.originalname, parsedVersion);
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
    const created = await (0, procedimentoModel_1.createProcedimento)({
        id: id?.trim() || (0, crypto_1.randomUUID)(),
        nome: trimmedName,
        pathPdf: storedPath,
        observacoes: parseOptionalObservacoes(observacoes),
        versao: parsedVersion,
        alteradoEm: new Date(),
    });
    if (!created) {
        throw new httpError_1.HttpError(500, "Nao foi possivel criar o procedimento.");
    }
    await (0, procedimentoProvaModel_1.replaceProcedimentoProvaQuestoes)(created.ID, created.VERSAO ?? parsedVersion, normalizedQuestoes);
    res.status(201).json({ procedimento: created });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { nome, pathPdf, versao, observacoes } = req.body;
    if (nome === undefined &&
        pathPdf === undefined &&
        versao === undefined &&
        observacoes === undefined) {
        throw new httpError_1.HttpError(400, "Informe ao menos um campo para atualizar");
    }
    const procedimento = await (0, procedimentoModel_1.updateProcedimento)(req.params.id, {
        nome: nome?.trim() || undefined,
        pathPdf: pathPdf?.trim() || undefined,
        observacoes: parseOptionalObservacoes(observacoes),
        versao: parseOptionalVersion(versao),
        alteradoEm: new Date(),
    });
    if (!procedimento) {
        throw new httpError_1.HttpError(404, "Procedimento nao encontrado");
    }
    await (0, userTrainingModel_1.archiveTrainingsByProcedimentoId)(req.params.id);
    res.json({ procedimento });
});
exports.updateUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const latest = await (0, procedimentoModel_1.getProcedimentoById)(req.params.id);
    if (!latest) {
        throw new httpError_1.HttpError(404, "Procedimento nao encontrado");
    }
    const { nome, versao, provaQuestoes } = req.body;
    const normalizedQuestoes = parseProcedimentoProvaQuestoes(provaQuestoes);
    const file = validatePdfFile(req.file);
    const parsedVersion = parseOptionalVersion(versao);
    const nextVersion = parsedVersion !== undefined
        ? Math.max(parsedVersion, (latest.VERSAO ?? 0) + 1)
        : (latest.VERSAO ?? 0) + 1;
    const nextName = nome?.trim() || latest.NOME;
    const folder = await resolveProcedureFolder();
    const fileName = buildProcedureFileName(nextName, file.originalname, nextVersion);
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
    const procedimento = await (0, procedimentoModel_1.updateProcedimento)(req.params.id, {
        nome: nextName,
        pathPdf: storedPath,
        observacoes: parseOptionalObservacoes(req.body?.observacoes),
        versao: nextVersion,
        alteradoEm: new Date(),
    });
    if (!procedimento) {
        throw new httpError_1.HttpError(404, "Procedimento nao encontrado");
    }
    await (0, procedimentoProvaModel_1.replaceProcedimentoProvaQuestoes)(procedimento.ID, procedimento.VERSAO ?? nextVersion, normalizedQuestoes);
    await (0, userTrainingModel_1.archiveTrainingsByProcedimentoId)(req.params.id);
    res.json({ procedimento });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const versions = await (0, procedimentoModel_1.listProcedimentoVersionsById)(req.params.id);
    await (0, procedimentoModel_1.deleteProcedimento)(req.params.id);
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
