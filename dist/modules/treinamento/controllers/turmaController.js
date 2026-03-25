"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCollectiveTurmaEvidencias = exports.getCollectiveTurmaById = exports.listCollectiveTurmas = exports.createCollectiveTurma = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const userMapping_1 = require("../utils/userMapping");
const userModel_1 = require("../models/userModel");
const storage_1 = require("../utils/storage");
const sharePointService_1 = require("../services/sharePointService");
const collectiveTrainingStorage_1 = require("../utils/collectiveTrainingStorage");
const turmaModel_1 = require("../models/turmaModel");
const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function toRecord(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const record = {};
    for (const [key, raw] of Object.entries(value)) {
        if (raw === null || raw === undefined)
            continue;
        const str = String(raw).trim();
        if (!str)
            continue;
        record[key] = str;
    }
    return record;
}
function buildPfunc(user) {
    const raw = toRecord(user.readView ?? user.raw ?? user.pfunc);
    if (raw) {
        return raw;
    }
    const record = {};
    const set = (key, value) => {
        if (value === null || value === undefined)
            return;
        const str = String(value).trim();
        if (!str)
            return;
        record[key] = str;
    };
    set("CPF", user.cpf ?? user.CPF);
    set("NOME", user.nome ?? user.NOME);
    set("NOME_FUNCAO", user.cargo ?? user.NOME_FUNCAO);
    set("NOME_SECAO", user.setor ?? user.NOME_SECAO ?? user.NOMEDEPARTAMENTO);
    set("NOMEDEPARTAMENTO", user.NOMEDEPARTAMENTO);
    set("NOMEFILIAL", user.nomeFilial ?? user.NOMEFILIAL);
    return record;
}
exports.createCollectiveTurma = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { nome, users, criadoPor, iniciadoEm } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
        throw new httpError_1.HttpError(400, "users e obrigatorio");
    }
    const uniqueUsers = new Map();
    for (const user of users) {
        const raw = buildPfunc(user);
        const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(raw.CPF ?? "");
        if (cpfDigits.length !== 11) {
            continue;
        }
        raw.CPF = cpfDigits;
        uniqueUsers.set(cpfDigits, raw);
    }
    if (uniqueUsers.size === 0) {
        throw new httpError_1.HttpError(400, "Nenhum colaborador valido informado");
    }
    for (const raw of uniqueUsers.values()) {
        const mapped = (0, userMapping_1.mapReadViewToUser)(raw);
        // eslint-disable-next-line no-await-in-loop
        await (0, userModel_1.upsertUser)(mapped);
    }
    const startedAt = iniciadoEm ? new Date(iniciadoEm) : new Date();
    if (Number.isNaN(startedAt.getTime())) {
        throw new httpError_1.HttpError(400, "iniciadoEm invalido");
    }
    const fallbackName = `Turma coletiva ${startedAt.toLocaleString("pt-BR")}`;
    const turma = await (0, turmaModel_1.createTurma)({
        nome: nome?.trim() || fallbackName,
        criadoPor: criadoPor?.trim() || null,
        iniciadoEm: startedAt,
        participantesCpf: Array.from(uniqueUsers.keys()),
    });
    res.status(201).json({ turma });
});
exports.listCollectiveTurmas = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { search } = req.query;
    const turmas = await (0, turmaModel_1.listTurmas)(search?.trim() || undefined);
    res.json({ turmas });
});
exports.getCollectiveTurmaById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { turmaId } = req.params;
    if (!GUID_REGEX.test(turmaId)) {
        throw new httpError_1.HttpError(400, "turmaId invalido");
    }
    const turma = await (0, turmaModel_1.getTurmaById)(turmaId);
    if (!turma) {
        throw new httpError_1.HttpError(404, "Turma nao encontrada");
    }
    const participantes = await (0, turmaModel_1.listTurmaParticipants)(turmaId);
    res.json({ turma, participantes });
});
exports.saveCollectiveTurmaEvidencias = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { turmaId } = req.params;
    if (!GUID_REGEX.test(turmaId)) {
        throw new httpError_1.HttpError(400, "turmaId invalido");
    }
    const turma = await (0, turmaModel_1.getTurmaById)(turmaId);
    if (!turma) {
        throw new httpError_1.HttpError(404, "Turma nao encontrada");
    }
    const { duracaoHoras, duracaoMinutos, finalizadoEm, criadoPor } = req.body;
    const horas = Number(duracaoHoras);
    const minutos = Number(duracaoMinutos);
    if (!Number.isInteger(horas) || horas < 0 || horas > 24) {
        throw new httpError_1.HttpError(400, "duracaoHoras invalido");
    }
    if (![0, 15, 30, 45].includes(minutos)) {
        throw new httpError_1.HttpError(400, "duracaoMinutos invalido");
    }
    const duracaoTotalMinutos = horas * 60 + minutos;
    if (duracaoTotalMinutos <= 0) {
        throw new httpError_1.HttpError(400, "Informe a duracao do treinamento");
    }
    const files = req.files ?? [];
    if (!files.length) {
        throw new httpError_1.HttpError(400, "Envie ao menos uma foto de evidencia do treinamento");
    }
    const finalizedAt = finalizadoEm ? new Date(finalizadoEm) : new Date();
    if (Number.isNaN(finalizedAt.getTime())) {
        throw new httpError_1.HttpError(400, "finalizadoEm invalido");
    }
    const obraLocalRaw = typeof req.body?.obraLocal === "string" && req.body.obraLocal.trim()
        ? req.body.obraLocal.trim()
        : "Matriz";
    const collectiveSpFolder = (0, collectiveTrainingStorage_1.buildCollectiveTrainingSharePointFolder)({
        obraLocal: obraLocalRaw,
        turma,
    });
    const movedPaths = [];
    try {
        const evidencias = [];
        const useSharePoint = (0, sharePointService_1.isSharePointEnabled)();
        if (!useSharePoint) {
            const relativeFolder = `turmas/${turmaId}/evidencias`;
            await (0, storage_1.ensurePublicDir)(relativeFolder);
        }
        else {
            await (0, sharePointService_1.ensureSharePointFolder)(collectiveSpFolder);
        }
        for (const file of files) {
            if (!file.mimetype?.startsWith("image/")) {
                throw new httpError_1.HttpError(400, "Todas as evidencias devem ser imagens");
            }
            const storedName = (0, storage_1.buildStoredFileName)(file.originalname || "evidencia.jpg", "evidencia");
            if (useSharePoint) {
                // eslint-disable-next-line no-await-in-loop
                const uploaded = await (0, sharePointService_1.uploadFileToSharePoint)({
                    tempFilePath: file.path,
                    relativeFolderPath: collectiveSpFolder,
                    fileName: storedName,
                    contentType: file.mimetype,
                });
                const arquivoPath = uploaded.webUrl ?? uploaded.fullPath;
                movedPaths.push(arquivoPath);
                evidencias.push({ arquivoPath });
            }
            else {
                const relativeFolder = `turmas/${turmaId}/evidencias`;
                const relativePath = `${relativeFolder}/${storedName}`.replace(/\\/g, "/");
                const destPath = (0, storage_1.toFsPath)(relativePath);
                // eslint-disable-next-line no-await-in-loop
                await (0, storage_1.moveFile)(file.path, destPath);
                movedPaths.push(relativePath);
                evidencias.push({ arquivoPath: relativePath });
            }
        }
        const updatedTurma = await (0, turmaModel_1.saveTurmaEncerramentoEvidencias)({
            turmaId,
            duracaoTreinamentoMinutos: duracaoTotalMinutos,
            finalizadoEm: finalizedAt,
            criadoPor: criadoPor?.trim() || null,
            evidencias,
        });
        res.status(200).json({
            turma: updatedTurma,
            evidencias: movedPaths.map((arquivoPath, index) => ({
                arquivoPath,
                ordem: index + 1,
            })),
        });
    }
    catch (error) {
        if (!(0, sharePointService_1.isSharePointEnabled)()) {
            await Promise.allSettled(movedPaths.map((relativePath) => promises_1.default.unlink(path_1.default.normalize((0, storage_1.toFsPath)(relativePath)))));
        }
        const code = error && typeof error === "object" && "code" in error
            ? String(error.code ?? "")
            : "";
        if (code === "TURMA_EVIDENCIA_SCHEMA_MISSING") {
            throw new httpError_1.HttpError(400, "Banco sem suporte a evidencias de treinamento coletivo. Execute a migration de turma/evidencias.");
        }
        if (error instanceof httpError_1.HttpError)
            throw error;
        throw error;
    }
    finally {
        await Promise.allSettled(files.map((file) => promises_1.default.unlink(file.path).catch(() => undefined)));
    }
});
