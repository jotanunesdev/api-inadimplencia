"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAttemptsReport = exports.getLatestObjectiveResult = exports.resolveCollectiveIndividualProofToken = exports.generateCollectiveIndividualProofQr = exports.submitObjectiveForCollective = exports.submitObjectiveForPlayer = exports.getObjectiveForPlayer = exports.createOrVersionEfficacy = exports.createOrVersionObjective = exports.getEfficacyByTrilha = exports.getObjectiveByTrilha = exports.remove = exports.updateUpload = exports.update = exports.createUpload = exports.create = exports.getById = exports.list = void 0;
const env_1 = require("../config/env");
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const userMapping_1 = require("../utils/userMapping");
const userModel_1 = require("../models/userModel");
const userTrainingModel_1 = require("../models/userTrainingModel");
const userTrilhaModel_1 = require("../models/userTrilhaModel");
const provaAttemptModel_1 = require("../models/provaAttemptModel");
const provaModel_1 = require("../models/provaModel");
const trilhaModel_1 = require("../models/trilhaModel");
const moduleModel_1 = require("../models/moduleModel");
const trainingWorkflowNotificationModel_1 = require("../models/trainingWorkflowNotificationModel");
const trainingWorkflowNotificationRealtime_1 = require("../services/trainingWorkflowNotificationRealtime");
const trainingNotificationRecipientService_1 = require("../services/trainingNotificationRecipientService");
const sectorAccess_1 = require("../utils/sectorAccess");
const collectiveProofToken_1 = require("../utils/collectiveProofToken");
const storage_1 = require("../utils/storage");
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
    const provas = await (0, provaModel_1.listProvas)(trilhaId, normalizedCpf);
    res.json({ provas });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const prova = await (0, provaModel_1.getProvaById)(req.params.id);
    if (!prova) {
        throw new httpError_1.HttpError(404, "Prova nao encontrada");
    }
    res.json({ prova });
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, trilhaId, provaPath, versao, modoAplicacao } = req.body;
    if (!id || !trilhaId || !provaPath) {
        throw new httpError_1.HttpError(400, "ID, trilhaId e provaPath sao obrigatorios");
    }
    const prova = await (0, provaModel_1.createProva)({
        id,
        trilhaId,
        provaPath,
        versao,
        modoAplicacao: (0, provaModel_1.normalizeProvaModoAplicacao)(modoAplicacao),
    });
    res.status(201).json({ prova });
});
exports.createUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, trilhaId, versao, modoAplicacao } = req.body;
    const file = req.file;
    if (!id || !trilhaId) {
        throw new httpError_1.HttpError(400, "ID e trilhaId sao obrigatorios");
    }
    if (!file) {
        throw new httpError_1.HttpError(400, "Arquivo de prova e obrigatorio");
    }
    const { trilhaPath } = await resolveTrilhaPath(trilhaId);
    const fileName = (0, storage_1.buildStoredFileName)(file.originalname, "prova");
    const relativePath = [trilhaPath, fileName].filter(Boolean).join("/");
    const destPath = (0, storage_1.toFsPath)(relativePath);
    await (0, storage_1.moveFile)(file.path, destPath);
    const prova = await (0, provaModel_1.createProva)({
        id,
        trilhaId,
        provaPath: relativePath,
        versao,
        modoAplicacao: (0, provaModel_1.normalizeProvaModoAplicacao)(modoAplicacao),
    });
    res.status(201).json({ prova });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId, provaPath, versao, modoAplicacao } = req.body;
    if (trilhaId === undefined &&
        provaPath === undefined &&
        versao === undefined) {
        throw new httpError_1.HttpError(400, "Informe ao menos um campo para atualizar");
    }
    const prova = await (0, provaModel_1.updateProva)(req.params.id, {
        trilhaId,
        provaPath,
        versao,
        modoAplicacao: modoAplicacao !== undefined
            ? (0, provaModel_1.normalizeProvaModoAplicacao)(modoAplicacao)
            : undefined,
    });
    if (!prova) {
        throw new httpError_1.HttpError(404, "Prova nao encontrada");
    }
    res.json({ prova });
});
exports.updateUpload = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId, versao, modoAplicacao } = req.body;
    const file = req.file;
    if (!file) {
        throw new httpError_1.HttpError(400, "Arquivo de prova e obrigatorio");
    }
    const resolvedTrilhaId = trilhaId ?? (await (0, provaModel_1.getProvaById)(req.params.id))?.TRILHA_FK_ID;
    if (!resolvedTrilhaId) {
        throw new httpError_1.HttpError(400, "trilhaId e obrigatorio");
    }
    const { trilhaPath } = await resolveTrilhaPath(resolvedTrilhaId);
    const fileName = (0, storage_1.buildStoredFileName)(file.originalname, "prova");
    const relativePath = [trilhaPath, fileName].filter(Boolean).join("/");
    const destPath = (0, storage_1.toFsPath)(relativePath);
    await (0, storage_1.moveFile)(file.path, destPath);
    const prova = await (0, provaModel_1.updateProva)(req.params.id, {
        trilhaId: resolvedTrilhaId,
        provaPath: relativePath,
        versao,
        modoAplicacao: modoAplicacao !== undefined
            ? (0, provaModel_1.normalizeProvaModoAplicacao)(modoAplicacao)
            : undefined,
    });
    if (!prova) {
        throw new httpError_1.HttpError(404, "Prova nao encontrada");
    }
    res.json({ prova });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    try {
        await (0, provaModel_1.deleteProva)(req.params.id);
    }
    catch (error) {
        const requestError = error;
        const message = requestError?.originalError?.info?.message ?? requestError?.message ?? "";
        if (requestError?.number === 547) {
            throw new httpError_1.HttpError(409, "Nao e possivel excluir esta prova porque existem tentativas, conclusoes ou registros associados.");
        }
        if (message) {
            throw new httpError_1.HttpError(400, message);
        }
        throw error;
    }
    res.status(204).send();
});
const round2 = (value) => Math.round(value * 100) / 100;
const MEDIA_APROVACAO = 6;
const DEFAULT_EFFICACY_DESTINATION_SECTOR = "recursos-humanos";
const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function readDatabaseErrorMessage(error) {
    if (!error || typeof error !== "object") {
        return "";
    }
    const requestError = error;
    return (requestError.originalError?.info?.message ??
        requestError.message ??
        "");
}
function isLegacySingleProofIndexError(error) {
    const message = readDatabaseErrorMessage(error);
    return message.includes("UX_TPROVAS_TRILHA");
}
function buildBalancedWeights(questionCount) {
    if (!Number.isFinite(questionCount) || questionCount <= 0) {
        return [];
    }
    const normalizedCount = Math.max(1, Math.trunc(questionCount));
    const weights = [];
    let accumulated = 0;
    for (let index = 0; index < normalizedCount; index += 1) {
        if (index === normalizedCount - 1) {
            weights.push(round2(10 - accumulated));
            break;
        }
        const weight = round2(10 / normalizedCount);
        accumulated += weight;
        weights.push(weight);
    }
    return weights;
}
function sanitizeStructuredQuestions(questoes, options) {
    if (!Array.isArray(questoes) || questoes.length === 0) {
        throw new httpError_1.HttpError(400, "A prova deve conter ao menos uma questao");
    }
    const efficacyWeights = buildBalancedWeights(questoes.length);
    return questoes.map((question, questionIndex) => {
        const enunciado = question.enunciado?.trim();
        if (!enunciado) {
            throw new httpError_1.HttpError(400, `Questao ${questionIndex + 1}: enunciado obrigatorio`);
        }
        const parsedPeso = Number(question.peso);
        const peso = options.requireCorrectOption
            ? parsedPeso
            : efficacyWeights[questionIndex] ?? 1;
        if (!Number.isFinite(peso) || peso <= 0) {
            throw new httpError_1.HttpError(400, `Questao ${questionIndex + 1}: peso invalido`);
        }
        if (!Array.isArray(question.opcoes) || question.opcoes.length < 2) {
            throw new httpError_1.HttpError(400, `Questao ${questionIndex + 1}: inclua ao menos 2 opcoes`);
        }
        const opcoes = question.opcoes.map((option, optionIndex) => {
            const texto = option.texto?.trim();
            if (!texto) {
                throw new httpError_1.HttpError(400, `Questao ${questionIndex + 1}, opcao ${optionIndex + 1}: texto obrigatorio`);
            }
            return {
                texto,
                correta: options.requireCorrectOption ? Boolean(option.correta) : false,
            };
        });
        if (options.requireCorrectOption) {
            const correctCount = opcoes.filter((option) => option.correta).length;
            if (correctCount !== 1) {
                throw new httpError_1.HttpError(400, `Questao ${questionIndex + 1}: deve existir exatamente 1 opcao correta`);
            }
        }
        return {
            enunciado,
            peso: round2(peso),
            opcoes,
        };
    });
}
async function resolveTrainingWorkflowContext(trilhaId) {
    const trilha = await (0, trilhaModel_1.getTrilhaById)(trilhaId);
    if (!trilha) {
        throw new httpError_1.HttpError(404, "Trilha nao encontrada");
    }
    const module = await (0, moduleModel_1.getModuleById)(trilha.MODULO_FK_ID);
    const ownerSector = (0, sectorAccess_1.resolveSectorDefinitionFromModuleName)(module?.NOME);
    return {
        module,
        ownerSector,
        trilha,
    };
}
async function broadcastWorkflowRecipients(usernames) {
    await Promise.all(Array.from(new Set(usernames.map((value) => (0, sectorAccess_1.normalizeUsernameValue)(value)).filter(Boolean))).map((username) => (0, trainingWorkflowNotificationRealtime_1.broadcastTrainingWorkflowNotificationSnapshot)(username)));
}
async function notifyHumanResourcesPendingEfficacy(params) {
    const workflowContext = await resolveTrainingWorkflowContext(params.trilhaId);
    if (!workflowContext.ownerSector ||
        workflowContext.ownerSector.key === DEFAULT_EFFICACY_DESTINATION_SECTOR) {
        return {
            recipientCount: 0,
            sent: false,
        };
    }
    const hasEficacia = await (0, trilhaModel_1.trilhaHasEficaciaConfig)(params.trilhaId).catch(() => false);
    if (hasEficacia) {
        return {
            recipientCount: 0,
            sent: false,
        };
    }
    const recipients = await (0, trainingNotificationRecipientService_1.listNotificationUsernamesBySectorKey)(DEFAULT_EFFICACY_DESTINATION_SECTOR);
    if (recipients.length === 0) {
        return {
            recipientCount: 0,
            sent: false,
        };
    }
    const author = (0, trainingNotificationRecipientService_1.buildTrainingNotificationAuthor)({
        authorName: params.actorName ?? workflowContext.trilha.CRIADO_POR ?? null,
        authorUsername: params.actorUsername ?? workflowContext.trilha.CRIADO_POR ?? null,
    });
    await Promise.all(recipients.map((recipientUsername) => (0, trainingWorkflowNotificationModel_1.createTrainingWorkflowNotification)({
        recipientUsername,
        type: "training_pending_efficacy",
        trainingId: workflowContext.trilha.ID,
        trainingTitle: workflowContext.trilha.TITULO,
        moduleId: workflowContext.trilha.MODULO_FK_ID,
        sourceSectorKey: workflowContext.ownerSector?.key ?? null,
        sourceSectorLabel: workflowContext.ownerSector?.label ?? null,
        destinationSectorKey: DEFAULT_EFFICACY_DESTINATION_SECTOR,
        authorName: author.authorName,
        authorUsername: author.authorUsername,
    })));
    await broadcastWorkflowRecipients(recipients);
    return {
        recipientCount: recipients.length,
        sent: true,
    };
}
async function notifyTrainingReadyForAssignment(params) {
    const workflowContext = await resolveTrainingWorkflowContext(params.trilhaId);
    const clearedRecipients = await (0, trainingWorkflowNotificationModel_1.clearTrainingWorkflowNotifications)({
        trainingId: workflowContext.trilha.ID,
        type: "training_pending_efficacy",
    });
    if (!workflowContext.ownerSector ||
        workflowContext.ownerSector.key === DEFAULT_EFFICACY_DESTINATION_SECTOR) {
        await broadcastWorkflowRecipients(clearedRecipients);
        return {
            recipientCount: 0,
            sent: false,
        };
    }
    const recipients = await (0, trainingNotificationRecipientService_1.listNotificationUsernamesBySectorKey)(workflowContext.ownerSector.key);
    const author = (0, trainingNotificationRecipientService_1.buildTrainingNotificationAuthor)({
        authorName: params.actorName ?? "Recursos Humanos",
        authorUsername: params.actorUsername ?? null,
    });
    await Promise.all(recipients.map((recipientUsername) => (0, trainingWorkflowNotificationModel_1.createTrainingWorkflowNotification)({
        recipientUsername,
        type: "training_ready_assignment",
        trainingId: workflowContext.trilha.ID,
        trainingTitle: workflowContext.trilha.TITULO,
        moduleId: workflowContext.trilha.MODULO_FK_ID,
        sourceSectorKey: workflowContext.ownerSector?.key ?? null,
        sourceSectorLabel: workflowContext.ownerSector?.label ?? null,
        destinationSectorKey: workflowContext.ownerSector?.key ?? null,
        authorName: author.authorName,
        authorUsername: author.authorUsername,
    })));
    await broadcastWorkflowRecipients([...clearedRecipients, ...recipients]);
    return {
        recipientCount: recipients.length,
        sent: recipients.length > 0,
    };
}
function sanitizeObjectiveProvaForPlayer(prova) {
    const modoAplicacao = (0, provaModel_1.normalizeProvaModoAplicacao)(prova.MODO_APLICACAO);
    return {
        ID: prova.ID,
        TRILHA_FK_ID: prova.TRILHA_FK_ID,
        VERSAO: prova.VERSAO,
        MODO_APLICACAO: modoAplicacao,
        TITULO: prova.TITULO,
        NOTA_TOTAL: prova.NOTA_TOTAL,
        ATUALIZADO_EM: prova.ATUALIZADO_EM,
        QUESTOES: prova.QUESTOES.map((question) => ({
            ID: question.ID,
            ORDEM: question.ORDEM,
            ENUNCIADO: question.ENUNCIADO,
            PESO: question.PESO,
            OPCOES: question.OPCOES.map((option) => ({
                ID: option.ID,
                ORDEM: option.ORDEM,
                TEXTO: option.TEXTO,
            })),
        })),
    };
}
function parseUserRecord(user) {
    if (!user || typeof user !== "object")
        return null;
    const record = {};
    for (const [key, rawValue] of Object.entries(user)) {
        if (rawValue === null || rawValue === undefined)
            continue;
        if (typeof rawValue === "object")
            continue;
        const value = String(rawValue).trim();
        if (!value)
            continue;
        record[key] = value;
    }
    return Object.keys(record).length > 0 ? record : null;
}
function assertTokenCanAccessTrilha(token, cpfDigits, trilhaId) {
    if (!token?.trim()) {
        return null;
    }
    let payload;
    try {
        payload = (0, collectiveProofToken_1.parseCollectiveProofToken)(token.trim());
        (0, collectiveProofToken_1.assertCollectiveProofTokenActive)(payload);
    }
    catch (error) {
        throw new httpError_1.HttpError(401, error instanceof Error ? error.message : "Token coletivo invalido");
    }
    if (!payload.cpfs.includes(cpfDigits)) {
        throw new httpError_1.HttpError(403, "CPF nao autorizado para este token coletivo");
    }
    if (!payload.trilhaIds.includes(trilhaId)) {
        throw new httpError_1.HttpError(403, "Trilha nao autorizada para este token coletivo");
    }
    return payload;
}
function evaluateObjectiveAnswers(prova, respostas) {
    const answerMap = new Map();
    for (const resposta of respostas) {
        const questaoId = resposta.questaoId?.trim();
        const opcaoId = resposta.opcaoId?.trim();
        if (!questaoId || !opcaoId)
            continue;
        answerMap.set(questaoId, opcaoId);
    }
    let score = 0;
    let hits = 0;
    const gabarito = [];
    for (const question of prova.QUESTOES) {
        const selectedOptionId = answerMap.get(question.ID) ?? null;
        const selectedOption = question.OPCOES.find((option) => option.ID === selectedOptionId) ?? null;
        const correctOption = question.OPCOES.find((option) => option.CORRETA);
        if (!correctOption) {
            throw new httpError_1.HttpError(500, "Questao sem alternativa correta cadastrada");
        }
        const isCorrect = selectedOption?.ID === correctOption.ID;
        if (isCorrect) {
            hits += 1;
            score += Number(question.PESO ?? 0);
        }
        gabarito.push({
            questaoId: question.ID,
            enunciado: question.ENUNCIADO,
            peso: Number(question.PESO ?? 0),
            opcaoMarcadaId: selectedOption?.ID ?? null,
            opcaoMarcadaTexto: selectedOption?.TEXTO ?? null,
            opcaoCorretaId: correctOption.ID,
            opcaoCorretaTexto: correctOption.TEXTO,
            acertou: isCorrect,
        });
    }
    const finalScore = round2(score);
    const status = finalScore >= MEDIA_APROVACAO ? "aprovado" : "reprovado";
    return {
        finalScore,
        status,
        hits,
        gabarito,
    };
}
exports.getObjectiveByTrilha = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { versao } = req.query;
    const parsedVersion = versao !== undefined && versao !== "" ? Number(versao) : undefined;
    if (parsedVersion !== undefined && (!Number.isFinite(parsedVersion) || parsedVersion <= 0)) {
        throw new httpError_1.HttpError(400, "versao invalida");
    }
    const prova = await (0, provaModel_1.getObjectiveProvaByTrilhaId)(req.params.trilhaId, parsedVersion);
    if (!prova) {
        res.json({ prova: null });
        return;
    }
    res.json({ prova });
});
exports.getEfficacyByTrilha = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { versao } = req.query;
    const parsedVersion = versao !== undefined && versao !== "" ? Number(versao) : undefined;
    if (parsedVersion !== undefined && (!Number.isFinite(parsedVersion) || parsedVersion <= 0)) {
        throw new httpError_1.HttpError(400, "versao invalida");
    }
    const prova = await (0, provaModel_1.getEfficacyProvaByTrilhaId)(req.params.trilhaId, parsedVersion);
    if (!prova) {
        res.json({ prova: null });
        return;
    }
    res.json({ prova });
});
exports.createOrVersionObjective = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId } = req.params;
    const { actorName, actorUsername, titulo, questoes, modoAplicacao } = req.body;
    if (!titulo?.trim()) {
        throw new httpError_1.HttpError(400, "titulo da prova e obrigatorio");
    }
    const normalizedQuestions = sanitizeStructuredQuestions(questoes, {
        requireCorrectOption: true,
    });
    const totalScore = round2(normalizedQuestions.reduce((total, question) => total + question.peso, 0));
    if (totalScore !== 10) {
        throw new httpError_1.HttpError(400, "A soma dos pesos das questoes deve ser exatamente 10");
    }
    const requestedModoAplicacao = (0, provaModel_1.normalizeProvaModoAplicacao)(modoAplicacao);
    const mustBeCollective = await (0, provaModel_1.proofExecutionMustBeCollective)(trilhaId);
    const finalModoAplicacao = mustBeCollective
        ? provaModel_1.PROVA_MODO_APLICACAO.COLETIVA
        : requestedModoAplicacao;
    let prova;
    try {
        prova = await (0, provaModel_1.createOrVersionObjectiveProva)({
            trilhaId,
            titulo: titulo.trim(),
            notaTotal: totalScore,
            modoAplicacao: finalModoAplicacao,
            questoes: normalizedQuestions,
        });
    }
    catch (error) {
        if (isLegacySingleProofIndexError(error)) {
            throw new httpError_1.HttpError(400, "Banco sem suporte a prova objetiva e avaliacao de eficacia na mesma trilha. Atualize os indices de dbo.TPROVAS.");
        }
        throw error;
    }
    const hrPendingNotification = await notifyHumanResourcesPendingEfficacy({
        actorName,
        actorUsername,
        trilhaId,
    });
    res.status(201).json({
        prova,
        rhPendingNotificationRecipientCount: hrPendingNotification.recipientCount,
        rhPendingNotificationSent: hrPendingNotification.sent,
    });
});
exports.createOrVersionEfficacy = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId } = req.params;
    const { actorName, actorUsername, questoes, titulo } = req.body;
    if (!titulo?.trim()) {
        throw new httpError_1.HttpError(400, "titulo da avaliacao de eficacia e obrigatorio");
    }
    const normalizedQuestions = sanitizeStructuredQuestions(questoes, {
        requireCorrectOption: false,
    });
    const totalScore = round2(normalizedQuestions.reduce((total, question) => total + question.peso, 0));
    let prova;
    try {
        prova = await (0, provaModel_1.createOrVersionEfficacyProva)({
            trilhaId,
            titulo: titulo.trim(),
            notaTotal: totalScore,
            modoAplicacao: provaModel_1.PROVA_MODO_APLICACAO.INDIVIDUAL,
            questoes: normalizedQuestions,
        });
    }
    catch (error) {
        if (isLegacySingleProofIndexError(error)) {
            throw new httpError_1.HttpError(400, "Banco sem suporte a prova objetiva e avaliacao de eficacia na mesma trilha. Atualize os indices de dbo.TPROVAS.");
        }
        throw error;
    }
    const firstQuestion = normalizedQuestions[0]?.enunciado ?? titulo.trim();
    try {
        await (0, trilhaModel_1.upsertTrilhaEficaciaConfig)(trilhaId, {
            pergunta: firstQuestion,
            obrigatoria: true,
            atualizadoEm: new Date(),
        });
    }
    catch (error) {
        const code = error && typeof error === "object" && "code" in error
            ? String(error.code ?? "")
            : "";
        if (code === "TRILHA_EFICACIA_CONFIG_COLUMNS_MISSING") {
            throw new httpError_1.HttpError(400, "Banco sem suporte a configuracao de avaliacao de eficacia por trilha. Execute a migration de TTRILHAS.");
        }
        throw error;
    }
    const readyNotification = await notifyTrainingReadyForAssignment({
        actorName,
        actorUsername,
        trilhaId,
    });
    res.status(201).json({
        prova,
        readyAssignmentNotificationRecipientCount: readyNotification.recipientCount,
        readyAssignmentNotificationSent: readyNotification.sent,
        resumoPergunta: firstQuestion,
    });
});
exports.getObjectiveForPlayer = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf, token } = req.query;
    if (cpf) {
        const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf);
        if (cpfDigits.length !== 11) {
            throw new httpError_1.HttpError(400, "CPF invalido");
        }
        const tokenPayload = assertTokenCanAccessTrilha(token, cpfDigits, req.params.trilhaId);
        if (!tokenPayload) {
            const assigned = await (0, userTrilhaModel_1.isUserAssignedToTrilha)(cpfDigits, req.params.trilhaId);
            if (!assigned) {
                throw new httpError_1.HttpError(403, "Trilha nao atribuida para este usuario");
            }
        }
    }
    const prova = await (0, provaModel_1.getObjectiveProvaForExecutionByTrilhaId)(req.params.trilhaId);
    if (!prova) {
        res.json({ prova: null });
        return;
    }
    res.json({ prova: sanitizeObjectiveProvaForPlayer(prova) });
});
exports.submitObjectiveForPlayer = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId } = req.params;
    const { cpf, respostas, user, token } = req.body;
    if (!cpf) {
        throw new httpError_1.HttpError(400, "cpf e obrigatorio");
    }
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf);
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    if (!Array.isArray(respostas)) {
        throw new httpError_1.HttpError(400, "respostas invalida");
    }
    const tokenPayload = assertTokenCanAccessTrilha(token, cpfDigits, trilhaId);
    if (!tokenPayload) {
        const assigned = await (0, userTrilhaModel_1.isUserAssignedToTrilha)(cpfDigits, trilhaId);
        if (!assigned) {
            throw new httpError_1.HttpError(403, "Trilha nao atribuida para este usuario");
        }
    }
    const prova = await (0, provaModel_1.getObjectiveProvaForExecutionByTrilhaId)(trilhaId);
    if (!prova) {
        throw new httpError_1.HttpError(404, "Prova objetiva nao encontrada para esta trilha");
    }
    const { finalScore, status, hits, gabarito } = evaluateObjectiveAnswers(prova, respostas);
    const normalizedUser = parseUserRecord(user);
    if (normalizedUser) {
        const mapped = (0, userMapping_1.mapReadViewToUser)({ ...normalizedUser, CPF: cpfDigits });
        await (0, userModel_1.upsertUser)(mapped);
    }
    else {
        await (0, userModel_1.upsertUser)({ cpf: cpfDigits, ativo: true });
    }
    await (0, provaAttemptModel_1.createProvaAttempt)({
        cpf: cpfDigits,
        provaId: prova.ID,
        provaVersao: prova.VERSAO,
        trilhaId,
        nota: finalScore,
        status,
        acertos: hits,
        totalQuestoes: prova.QUESTOES.length,
        respostasJson: JSON.stringify({
            respostas: respostas.map((resposta) => ({
                questaoId: resposta.questaoId ?? null,
                opcaoId: resposta.opcaoId ?? null,
            })),
            gabarito,
        }),
    });
    if (status === "aprovado") {
        await (0, userTrainingModel_1.recordUserTraining)({
            cpf: cpfDigits,
            tipo: "prova",
            materialId: prova.ID,
            materialVersao: prova.VERSAO,
            turmaId: tokenPayload?.turmaId ?? null,
            concluidoEm: new Date(),
            origem: tokenPayload
                ? "prova-objectiva-coletiva-individual"
                : "prova-objectiva",
        });
    }
    res.status(201).json({
        nota: finalScore,
        media: MEDIA_APROVACAO,
        status,
        acertos: hits,
        totalQuestoes: prova.QUESTOES.length,
        aprovado: status === "aprovado",
        gabarito,
        prova: {
            id: prova.ID,
            versao: prova.VERSAO,
            titulo: prova.TITULO,
        },
    });
});
exports.submitObjectiveForCollective = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { trilhaId } = req.params;
    const { users, respostas, turmaId, concluidoEm, origem } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
        throw new httpError_1.HttpError(400, "users e obrigatorio");
    }
    if (!Array.isArray(respostas)) {
        throw new httpError_1.HttpError(400, "respostas invalida");
    }
    const prova = await (0, provaModel_1.getObjectiveProvaForExecutionByTrilhaId)(trilhaId);
    if (!prova) {
        throw new httpError_1.HttpError(404, "Prova objetiva nao encontrada para esta trilha");
    }
    if ((0, provaModel_1.normalizeProvaModoAplicacao)(prova.MODO_APLICACAO) === provaModel_1.PROVA_MODO_APLICACAO.INDIVIDUAL) {
        throw new httpError_1.HttpError(409, "Esta prova esta configurada para realizacao individual e nao pode ser aplicada em modo coletivo.");
    }
    const concluidoDate = concluidoEm ? new Date(concluidoEm) : new Date();
    if (Number.isNaN(concluidoDate.getTime())) {
        throw new httpError_1.HttpError(400, "concluidoEm invalido");
    }
    if (turmaId && !GUID_REGEX.test(turmaId)) {
        throw new httpError_1.HttpError(400, "turmaId invalido");
    }
    const { finalScore, status, hits, gabarito } = evaluateObjectiveAnswers(prova, respostas);
    const uniqueUsers = new Map();
    for (const user of users) {
        const raw = parseUserRecord(user);
        if (!raw)
            continue;
        const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(raw.CPF ?? raw.cpf ?? "");
        if (cpfDigits.length !== 11)
            continue;
        raw.CPF = cpfDigits;
        uniqueUsers.set(cpfDigits, raw);
    }
    if (uniqueUsers.size === 0) {
        throw new httpError_1.HttpError(400, "Nenhum usuario valido informado");
    }
    const serializedAnswers = JSON.stringify({
        respostas: respostas.map((resposta) => ({
            questaoId: resposta.questaoId ?? null,
            opcaoId: resposta.opcaoId ?? null,
        })),
        gabarito,
    });
    let attemptsCreated = 0;
    let approvalsCreated = 0;
    for (const [cpfDigits, raw] of uniqueUsers.entries()) {
        const mapped = (0, userMapping_1.mapReadViewToUser)(raw);
        // eslint-disable-next-line no-await-in-loop
        await (0, userModel_1.upsertUser)(mapped);
        // eslint-disable-next-line no-await-in-loop
        await (0, provaAttemptModel_1.createProvaAttempt)({
            cpf: cpfDigits,
            provaId: prova.ID,
            provaVersao: prova.VERSAO,
            trilhaId,
            nota: finalScore,
            status,
            acertos: hits,
            totalQuestoes: prova.QUESTOES.length,
            respostasJson: serializedAnswers,
            realizadoEm: concluidoDate,
        });
        attemptsCreated += 1;
        if (status === "aprovado") {
            // eslint-disable-next-line no-await-in-loop
            const inserted = await (0, userTrainingModel_1.recordUserTraining)({
                cpf: cpfDigits,
                tipo: "prova",
                materialId: prova.ID,
                materialVersao: prova.VERSAO,
                turmaId: turmaId ?? null,
                concluidoEm: concluidoDate,
                origem: origem?.trim() || "prova-objectiva-coletiva",
            });
            if (inserted)
                approvalsCreated += 1;
        }
    }
    res.status(201).json({
        nota: finalScore,
        media: MEDIA_APROVACAO,
        status,
        acertos: hits,
        totalQuestoes: prova.QUESTOES.length,
        aprovado: status === "aprovado",
        gabarito,
        prova: {
            id: prova.ID,
            versao: prova.VERSAO,
            titulo: prova.TITULO,
        },
        usuariosAvaliados: uniqueUsers.size,
        tentativasRegistradas: attemptsCreated,
        aprovacoesRegistradas: approvalsCreated,
    });
});
function sanitizeObjectiveProvaListItem(prova) {
    const modoAplicacao = (0, provaModel_1.normalizeProvaModoAplicacao)(prova.MODO_APLICACAO);
    return {
        ID: prova.ID,
        TRILHA_FK_ID: prova.TRILHA_FK_ID,
        VERSAO: prova.VERSAO,
        TITULO: prova.TITULO,
        NOTA_TOTAL: prova.NOTA_TOTAL,
        MODO_APLICACAO: modoAplicacao,
    };
}
exports.generateCollectiveIndividualProofQr = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { users, trilhaIds, turmaId, redirectBaseUrl } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
        throw new httpError_1.HttpError(400, "users e obrigatorio");
    }
    if (!Array.isArray(trilhaIds) || trilhaIds.length === 0) {
        throw new httpError_1.HttpError(400, "trilhaIds e obrigatorio");
    }
    if (turmaId && !GUID_REGEX.test(turmaId)) {
        throw new httpError_1.HttpError(400, "turmaId invalido");
    }
    const cpfs = new Set();
    for (const user of users) {
        const parsed = parseUserRecord(user);
        if (!parsed)
            continue;
        const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(parsed.CPF ?? parsed.cpf ?? "");
        if (cpfDigits.length === 11) {
            cpfs.add(cpfDigits);
        }
    }
    if (!cpfs.size) {
        throw new httpError_1.HttpError(400, "Nenhum CPF valido informado");
    }
    const validTrilhaIds = Array.from(new Set(trilhaIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => GUID_REGEX.test(id))));
    if (!validTrilhaIds.length) {
        throw new httpError_1.HttpError(400, "Nenhuma trilha valida informada");
    }
    const provasIndividuais = [];
    for (const trilhaId of validTrilhaIds) {
        // eslint-disable-next-line no-await-in-loop
        const prova = await (0, provaModel_1.getObjectiveProvaForExecutionByTrilhaId)(trilhaId);
        if (!prova)
            continue;
        if ((0, provaModel_1.normalizeProvaModoAplicacao)(prova.MODO_APLICACAO) !== provaModel_1.PROVA_MODO_APLICACAO.INDIVIDUAL)
            continue;
        provasIndividuais.push(prova);
    }
    if (!provasIndividuais.length) {
        throw new httpError_1.HttpError(400, "Nenhuma das trilhas selecionadas possui prova configurada para aplicacao individual.");
    }
    const { token, payload } = (0, collectiveProofToken_1.createCollectiveProofToken)({
        cpfs: Array.from(cpfs),
        trilhaIds: provasIndividuais.map((item) => item.TRILHA_FK_ID),
        turmaId: turmaId ?? null,
    });
    const baseUrl = (typeof redirectBaseUrl === "string" && redirectBaseUrl.trim()) ||
        env_1.env.COLLECTIVE_PROVA_REDIRECT_BASE_URL;
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
    const redirectUrl = `${normalizedBaseUrl}/?coletivoProvaToken=${encodeURIComponent(token)}`;
    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(redirectUrl)}`;
    res.status(201).json({
        token,
        redirectUrl,
        qrCodeImageUrl,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        trilhas: provasIndividuais.map(sanitizeObjectiveProvaListItem),
        totalUsuarios: cpfs.size,
    });
});
exports.resolveCollectiveIndividualProofToken = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const token = String(req.params.token ?? "").trim();
    if (!token) {
        throw new httpError_1.HttpError(400, "token e obrigatorio");
    }
    let payload;
    try {
        payload = (0, collectiveProofToken_1.parseCollectiveProofToken)(token);
        (0, collectiveProofToken_1.assertCollectiveProofTokenActive)(payload);
    }
    catch (error) {
        throw new httpError_1.HttpError(401, error instanceof Error ? error.message : "Token coletivo invalido");
    }
    const cpfQuery = String(req.query.cpf ?? "").trim();
    if (cpfQuery) {
        const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpfQuery);
        if (cpfDigits.length !== 11) {
            throw new httpError_1.HttpError(400, "CPF invalido");
        }
        if (!payload.cpfs.includes(cpfDigits)) {
            throw new httpError_1.HttpError(403, "CPF nao autorizado para este token coletivo");
        }
    }
    const provas = [];
    for (const trilhaId of payload.trilhaIds) {
        // eslint-disable-next-line no-await-in-loop
        const prova = await (0, provaModel_1.getObjectiveProvaByTrilhaId)(trilhaId);
        if (!prova)
            continue;
        provas.push(sanitizeObjectiveProvaListItem(prova));
    }
    res.json({
        token,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        turmaId: payload.turmaId,
        trilhas: payload.trilhaIds,
        cpfs: payload.cpfs,
        provas,
    });
});
exports.getLatestObjectiveResult = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf } = req.query;
    if (!cpf) {
        throw new httpError_1.HttpError(400, "cpf e obrigatorio");
    }
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf);
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    const trilhaId = req.params.trilhaId;
    const [attempt, latestProva] = await Promise.all([
        (0, provaAttemptModel_1.getLatestProvaAttemptByTrilha)(cpfDigits, trilhaId),
        (0, provaModel_1.getObjectiveProvaByTrilhaId)(trilhaId),
    ]);
    if (!attempt) {
        res.json({ result: null });
        return;
    }
    if (!latestProva) {
        res.json({ result: null });
        return;
    }
    if (attempt.PROVA_ID !== latestProva.ID || attempt.PROVA_VERSAO !== latestProva.VERSAO) {
        res.json({ result: null });
        return;
    }
    const progress = await (0, userTrainingModel_1.getUserCurrentVideoProgressByTrilha)(cpfDigits, trilhaId);
    if (progress.TOTAL_VIDEOS_ATUAIS > 0 &&
        progress.TOTAL_CONCLUIDOS_ATUAIS < progress.TOTAL_VIDEOS_ATUAIS) {
        res.json({ result: null });
        return;
    }
    if (progress.ULTIMA_CONCLUSAO_ATUAL) {
        const attemptDate = new Date(attempt.DT_REALIZACAO);
        const latestVideoConclusion = new Date(progress.ULTIMA_CONCLUSAO_ATUAL);
        if (attemptDate < latestVideoConclusion) {
            res.json({ result: null });
            return;
        }
    }
    let respostas = null;
    if (attempt.RESPOSTAS_JSON) {
        try {
            respostas = JSON.parse(attempt.RESPOSTAS_JSON);
        }
        catch {
            respostas = null;
        }
    }
    res.json({
        result: {
            ...attempt,
            RESPOSTAS: respostas,
        },
    });
});
function parseDateRangeBoundary(raw, endOfDay = false) {
    if (!raw) {
        return undefined;
    }
    const value = raw.trim();
    if (!value) {
        return undefined;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    const date = endOfDay
        ? new Date(`${value}T23:59:59.999`)
        : new Date(`${value}T00:00:00.000`);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
}
exports.listAttemptsReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { status, dateFrom, dateTo, trilhaId } = req.query;
    let normalizedStatus;
    if (status) {
        const value = status.trim().toLowerCase();
        if (value !== "aprovado" && value !== "reprovado") {
            throw new httpError_1.HttpError(400, "status invalido");
        }
        normalizedStatus = value;
    }
    const parsedDateFrom = parseDateRangeBoundary(dateFrom, false);
    if (parsedDateFrom === null) {
        throw new httpError_1.HttpError(400, "dateFrom invalida. Use o formato YYYY-MM-DD");
    }
    const parsedDateTo = parseDateRangeBoundary(dateTo, true);
    if (parsedDateTo === null) {
        throw new httpError_1.HttpError(400, "dateTo invalida. Use o formato YYYY-MM-DD");
    }
    if (parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo) {
        throw new httpError_1.HttpError(400, "dateFrom nao pode ser maior que dateTo");
    }
    const report = await (0, provaAttemptModel_1.listProvaAttemptsReport)({
        status: normalizedStatus,
        dateFrom: parsedDateFrom ?? undefined,
        dateTo: parsedDateTo ?? undefined,
        trilhaId: trilhaId?.trim() || undefined,
    });
    res.json({ report });
});
