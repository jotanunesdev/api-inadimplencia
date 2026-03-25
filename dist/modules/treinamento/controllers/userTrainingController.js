"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listArchivedCompletionReportByFunction = exports.listCompletionReportByFunction = exports.listVideoCompletions = exports.listCompletedVideosByCpf = exports.recordVideoCompletion = exports.recordCollectiveEficacia = exports.recordTrilhaEficacia = exports.attachCollectiveFaceEvidence = exports.recordAttendance = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const userMapping_1 = require("../utils/userMapping");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const userModel_1 = require("../models/userModel");
const userTrainingModel_1 = require("../models/userTrainingModel");
const videoModel_1 = require("../models/videoModel");
const trilhaModel_1 = require("../models/trilhaModel");
const turmaModel_1 = require("../models/turmaModel");
const collectiveTrainingStorage_1 = require("../utils/collectiveTrainingStorage");
const sharePointService_1 = require("../services/sharePointService");
const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const EFICACIA_MIN = 1;
const EFICACIA_MAX = 5;
function toRecord(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const record = {};
    for (const [key, raw] of Object.entries(value)) {
        if (raw === null || raw === undefined) {
            continue;
        }
        const str = String(raw).trim();
        if (!str) {
            continue;
        }
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
    set("SEXO", user.sexo ?? user.SEXO);
    set("IDADE", user.idade ?? user.IDADE);
    set("DTNASCIMENTO", user.dtNascimento ?? user.DTNASCIMENTO);
    return record;
}
function parseEficaciaNivel(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < EFICACIA_MIN || parsed > EFICACIA_MAX) {
        throw new httpError_1.HttpError(400, "nivel de eficacia invalido");
    }
    return parsed;
}
exports.recordAttendance = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { users, trainings, turmaId, concluidoEm, origem } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
        throw new httpError_1.HttpError(400, "Lista de usuarios e obrigatoria");
    }
    if (!Array.isArray(trainings) || trainings.length === 0) {
        throw new httpError_1.HttpError(400, "Lista de treinamentos e obrigatoria");
    }
    const concludedAt = concluidoEm ? new Date(concluidoEm) : new Date();
    if (Number.isNaN(concludedAt.getTime())) {
        throw new httpError_1.HttpError(400, "concluidoEm invalido");
    }
    if (turmaId && !GUID_REGEX.test(turmaId)) {
        throw new httpError_1.HttpError(400, "turmaId invalido");
    }
    const normalizedTrainingsRaw = await Promise.all(trainings.map(async (item) => {
        const tipo = item.tipo;
        if (tipo !== "video" && tipo !== "pdf" && tipo !== "prova") {
            throw new httpError_1.HttpError(400, "tipo de treinamento invalido");
        }
        const materialId = item.id ?? item.materialId;
        if (!materialId) {
            throw new httpError_1.HttpError(400, "materialId e obrigatorio");
        }
        if (!GUID_REGEX.test(materialId)) {
            throw new httpError_1.HttpError(400, "materialId invalido");
        }
        let materialVersao = item.versao ?? item.materialVersao ?? null;
        if (tipo === "video" && materialVersao === null) {
            const video = await (0, videoModel_1.getVideoById)(materialId);
            if (!video) {
                throw new httpError_1.HttpError(404, "Video nao encontrado");
            }
            materialVersao = video.VERSAO;
        }
        return {
            tipo,
            materialId,
            materialVersao,
        };
    }));
    const normalizedTrainings = Array.from(new Map(normalizedTrainingsRaw.map((training) => [
        `${training.tipo}|${training.materialId}|${training.materialVersao ?? "null"}`,
        training,
    ])).values());
    let inserted = 0;
    for (const user of users) {
        const raw = buildPfunc(user);
        const cpfValue = (0, normalizeCpf_1.normalizeCpf)(raw.CPF ?? "");
        if (!cpfValue) {
            throw new httpError_1.HttpError(400, "CPF do usuario e obrigatorio");
        }
        raw.CPF = cpfValue;
        const mapped = (0, userMapping_1.mapReadViewToUser)(raw);
        await (0, userModel_1.upsertUser)(mapped);
        const inputs = normalizedTrainings.map((training) => ({
            cpf: cpfValue,
            tipo: training.tipo,
            materialId: training.materialId,
            materialVersao: training.materialVersao,
            turmaId: turmaId ?? null,
            concluidoEm: concludedAt,
            origem: origem ?? "presenca",
        }));
        // eslint-disable-next-line no-await-in-loop
        const result = await (0, userTrainingModel_1.recordUserTrainings)(inputs);
        inserted += result.inserted;
    }
    res.status(201).json({ inserted });
});
exports.attachCollectiveFaceEvidence = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { turmaId, captures } = req.body;
    if (!turmaId || !GUID_REGEX.test(turmaId)) {
        throw new httpError_1.HttpError(400, "turmaId invalido");
    }
    if (!Array.isArray(captures) || captures.length === 0) {
        throw new httpError_1.HttpError(400, "captures e obrigatorio");
    }
    const turma = await (0, turmaModel_1.getTurmaById)(turmaId);
    if (!turma) {
        throw new httpError_1.HttpError(404, "Turma nao encontrada");
    }
    const obraLocal = typeof req.body?.obraLocal === "string" && req.body.obraLocal.trim()
        ? req.body.obraLocal.trim()
        : "Matriz";
    const canUploadToTrainingFolder = (0, sharePointService_1.isSharePointEnabled)();
    const trainingFolder = canUploadToTrainingFolder
        ? (0, collectiveTrainingStorage_1.buildCollectiveTrainingSharePointFolder)({
            obraLocal,
            turma,
        })
        : null;
    let updated = 0;
    let processed = 0;
    for (const capture of captures) {
        const cpf = (0, normalizeCpf_1.normalizeCpf)(String(capture?.cpf ?? ""));
        if (cpf.length !== 11) {
            continue;
        }
        const fotoUrl = typeof capture?.fotoUrl === "string" && capture.fotoUrl.trim()
            ? capture.fotoUrl.trim()
            : null;
        const fotoBase64 = typeof capture?.fotoBase64 === "string" && capture.fotoBase64.trim()
            ? capture.fotoBase64.trim()
            : null;
        if (!fotoUrl && !fotoBase64) {
            continue;
        }
        let effectiveFotoUrl = fotoUrl;
        let effectiveFotoBase64 = fotoBase64;
        if (trainingFolder && (fotoBase64 || fotoUrl)) {
            try {
                let base64ForUpload = fotoBase64;
                if (!base64ForUpload && fotoUrl) {
                    // Quando a facial ja vem salva com URL, copia o arquivo para a pasta do treinamento.
                    // eslint-disable-next-line no-await-in-loop
                    const spBuffer = await (0, sharePointService_1.downloadSharePointFileByUrl)(fotoUrl);
                    base64ForUpload = `data:image/jpeg;base64,${spBuffer.toString("base64")}`;
                }
                if (base64ForUpload) {
                    // eslint-disable-next-line no-await-in-loop
                    const uploaded = await (0, sharePointService_1.uploadBase64ToSharePoint)({
                        base64Data: base64ForUpload,
                        relativeFolderPath: trainingFolder,
                        fileNamePrefix: `facial-${cpf}`,
                        contentType: "image/jpeg",
                    });
                    effectiveFotoUrl = uploaded.webUrl ?? effectiveFotoUrl;
                    // prioriza URL da pasta do treinamento para o dossie; nao precisa manter base64
                    effectiveFotoBase64 = null;
                }
            }
            catch (error) {
                console.warn("[Turma] Falha ao copiar facial da turma para pasta SharePoint do treinamento:", error);
            }
        }
        let confirmadoEm = null;
        if (capture?.createdAt) {
            const parsed = new Date(capture.createdAt);
            if (!Number.isNaN(parsed.getTime())) {
                confirmadoEm = parsed;
            }
        }
        try {
            // eslint-disable-next-line no-await-in-loop
            updated += await (0, userTrainingModel_1.attachFaceEvidenceToTurmaTrainings)({
                cpf,
                turmaId,
                fotoConfirmacaoUrl: effectiveFotoUrl,
                fotoConfirmacaoBase64: effectiveFotoBase64,
                confirmadoEm,
            });
            processed += 1;
        }
        catch (error) {
            const code = error && typeof error === "object" && "code" in error
                ? String(error.code ?? "")
                : "";
            if (code === "USER_TRAINING_FACE_EVIDENCE_COLUMNS_MISSING") {
                throw new httpError_1.HttpError(400, "Banco sem suporte a foto por treinamento no dossie. Execute a migration de face de confirmacao em TUSUARIO_TREINAMENTOS.");
            }
            throw error;
        }
    }
    res.status(200).json({ processed, updated });
});
exports.recordTrilhaEficacia = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf, trilhaId, nivel, avaliadoEm } = req.body;
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf ?? "");
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    if (!trilhaId || !GUID_REGEX.test(trilhaId)) {
        throw new httpError_1.HttpError(400, "trilhaId invalido");
    }
    const parsedNivel = parseEficaciaNivel(nivel);
    const avaliadoDate = avaliadoEm ? new Date(avaliadoEm) : new Date();
    if (Number.isNaN(avaliadoDate.getTime())) {
        throw new httpError_1.HttpError(400, "avaliadoEm invalido");
    }
    try {
        const hasEficaciaConfig = await (0, trilhaModel_1.trilhaHasEficaciaConfig)(trilhaId);
        if (!hasEficaciaConfig) {
            throw new httpError_1.HttpError(400, "Esta trilha nao possui avaliacao de eficacia configurada.");
        }
        const updated = await (0, userTrainingModel_1.recordTrainingEficaciaByTrilha)({
            cpf: cpfDigits,
            trilhaId,
            nivel: parsedNivel,
            avaliadoEm: avaliadoDate,
        });
        res.status(200).json({ updated });
    }
    catch (error) {
        const code = error && typeof error === "object" && "code" in error
            ? String(error.code ?? "")
            : "";
        if (code === "USER_TRAINING_EFICACY_COLUMNS_MISSING") {
            throw new httpError_1.HttpError(400, "Banco sem suporte a avaliacao de eficacia em TUSUARIO_TREINAMENTOS. Execute a migration de avaliacao de eficacia.");
        }
        if (code === "TRILHA_EFICACIA_CONFIG_COLUMNS_MISSING") {
            throw new httpError_1.HttpError(400, "Banco sem suporte a configuracao de avaliacao de eficacia por trilha. Execute a migration de TTRILHAS.");
        }
        if (error instanceof httpError_1.HttpError) {
            throw error;
        }
        throw error;
    }
});
exports.recordCollectiveEficacia = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { turmaId, avaliacoes, avaliadoEm } = req.body;
    if (!turmaId || !GUID_REGEX.test(turmaId)) {
        throw new httpError_1.HttpError(400, "turmaId invalido");
    }
    if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) {
        throw new httpError_1.HttpError(400, "avaliacoes e obrigatorio");
    }
    const normalized = new Map();
    for (const item of avaliacoes) {
        const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(item?.cpf ?? "");
        if (cpfDigits.length !== 11) {
            continue;
        }
        const parsedNivel = parseEficaciaNivel(item?.nivel);
        normalized.set(cpfDigits, { cpf: cpfDigits, nivel: parsedNivel });
    }
    if (normalized.size === 0) {
        throw new httpError_1.HttpError(400, "Nenhuma avaliacao valida informada");
    }
    const avaliadoDate = avaliadoEm ? new Date(avaliadoEm) : new Date();
    if (Number.isNaN(avaliadoDate.getTime())) {
        throw new httpError_1.HttpError(400, "avaliadoEm invalido");
    }
    try {
        const result = await (0, userTrainingModel_1.recordTrainingEficaciaByTurma)({
            turmaId,
            avaliadoEm: avaliadoDate,
            avaliacoes: Array.from(normalized.values()),
        });
        res.status(200).json(result);
    }
    catch (error) {
        const code = error && typeof error === "object" && "code" in error
            ? String(error.code ?? "")
            : "";
        if (code === "USER_TRAINING_EFICACY_COLUMNS_MISSING") {
            throw new httpError_1.HttpError(400, "Banco sem suporte a avaliacao de eficacia em TUSUARIO_TREINAMENTOS. Execute a migration de avaliacao de eficacia.");
        }
        throw error;
    }
});
exports.recordVideoCompletion = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf, videoId, materialVersao, concluidoEm, origem, user } = req.body;
    if (!cpf || !videoId) {
        throw new httpError_1.HttpError(400, "cpf e videoId sao obrigatorios");
    }
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf);
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    if (!GUID_REGEX.test(videoId)) {
        throw new httpError_1.HttpError(400, "videoId invalido");
    }
    const parsedVersion = materialVersao !== undefined && materialVersao !== null
        ? Number(materialVersao)
        : undefined;
    if (parsedVersion !== undefined && (!Number.isFinite(parsedVersion) || parsedVersion <= 0)) {
        throw new httpError_1.HttpError(400, "materialVersao invalida");
    }
    const concludedAt = concluidoEm ? new Date(concluidoEm) : new Date();
    if (Number.isNaN(concludedAt.getTime())) {
        throw new httpError_1.HttpError(400, "concluidoEm invalido");
    }
    const video = await (0, videoModel_1.getVideoById)(videoId, parsedVersion);
    if (!video) {
        throw new httpError_1.HttpError(404, "Video nao encontrado");
    }
    const assigned = await (0, userTrainingModel_1.isVideoAssignedToUser)(cpfDigits, videoId);
    if (!assigned) {
        throw new httpError_1.HttpError(403, "Video nao atribuido para este usuario");
    }
    if (user && typeof user === "object") {
        const raw = buildPfunc({ ...user, cpf: cpfDigits, CPF: cpfDigits });
        const mapped = (0, userMapping_1.mapReadViewToUser)(raw);
        await (0, userModel_1.upsertUser)(mapped);
    }
    else {
        await (0, userModel_1.upsertUser)({ cpf: cpfDigits, ativo: true });
    }
    const inserted = await (0, userTrainingModel_1.recordUserTraining)({
        cpf: cpfDigits,
        tipo: "video",
        materialId: videoId,
        materialVersao: video.VERSAO,
        concluidoEm: concludedAt,
        origem: origem ?? "player",
    });
    res.status(201).json({
        inserted: inserted ? 1 : 0,
        completedAt: concludedAt.toISOString(),
    });
});
exports.listCompletedVideosByCpf = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(req.params.cpf);
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    const completions = await (0, userTrainingModel_1.listUserVideoCompletions)(cpfDigits);
    res.json({ completions });
});
exports.listVideoCompletions = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { materialId, versao } = req.query;
    if (!materialId) {
        throw new httpError_1.HttpError(400, "materialId e obrigatorio");
    }
    if (!GUID_REGEX.test(materialId)) {
        throw new httpError_1.HttpError(400, "materialId invalido");
    }
    const parsedVersion = versao !== undefined && versao !== "" ? Number(versao) : undefined;
    if (parsedVersion !== undefined && (!Number.isFinite(parsedVersion) || parsedVersion <= 0)) {
        throw new httpError_1.HttpError(400, "versao invalida");
    }
    const completions = await (0, userTrainingModel_1.listVideoCompletionsByMaterial)(materialId, parsedVersion);
    res.json({ completions });
});
exports.listCompletionReportByFunction = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { funcao, turma } = req.query;
    const report = await (0, userTrainingModel_1.listCompletionReport)(funcao?.trim() || undefined, turma?.trim() || undefined);
    res.json({ report });
});
exports.listArchivedCompletionReportByFunction = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { funcao, turma } = req.query;
    const report = await (0, userTrainingModel_1.listArchivedCompletionReport)(funcao?.trim() || undefined, turma?.trim() || undefined);
    res.json({ report });
});
