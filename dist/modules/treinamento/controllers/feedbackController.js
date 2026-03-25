"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrainingFeedbackDashboardSummary = exports.submitPlatformSatisfaction = exports.getPlatformSatisfactionStatus = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const userTrainingModel_1 = require("../models/userTrainingModel");
const turmaModel_1 = require("../models/turmaModel");
const platformSatisfactionModel_1 = require("../models/platformSatisfactionModel");
const SATISFACAO_MIN = 1;
const SATISFACAO_MAX = 5;
const SATISFACAO_INTERVAL_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
function buildLast12MonthsTemplate(referenceDate = new Date()) {
    const labels = [];
    const keys = [];
    const now = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    for (let offset = 11; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const ano = date.getFullYear();
        const mes = date.getMonth() + 1;
        keys.push(`${ano}-${String(mes).padStart(2, "0")}`);
        labels.push(date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }));
    }
    return { labels, keys };
}
function toNumber(value) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}
function parseNivel(value) {
    const nivel = Number(value);
    if (!Number.isInteger(nivel) || nivel < SATISFACAO_MIN || nivel > SATISFACAO_MAX) {
        throw new httpError_1.HttpError(400, "nivel de satisfacao invalido");
    }
    return nivel;
}
exports.getPlatformSatisfactionStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(req.params.cpf ?? req.query.cpf ?? "");
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    try {
        const latest = await (0, platformSatisfactionModel_1.getLatestPlatformSatisfactionByCpf)(cpfDigits);
        if (!latest) {
            res.json({
                deveExibir: true,
                intervaloDias: SATISFACAO_INTERVAL_DAYS,
                ultimaRespostaEm: null,
                proximaDisponivelEm: null,
                diasDesdeUltima: null,
            });
            return;
        }
        const now = new Date();
        const nextDue = new Date(latest.RESPONDIDO_EM.getTime() + SATISFACAO_INTERVAL_DAYS * DAY_MS);
        const diffDays = Math.floor((now.getTime() - latest.RESPONDIDO_EM.getTime()) / DAY_MS);
        res.json({
            deveExibir: now.getTime() >= nextDue.getTime(),
            intervaloDias: SATISFACAO_INTERVAL_DAYS,
            ultimaRespostaEm: latest.RESPONDIDO_EM.toISOString(),
            proximaDisponivelEm: nextDue.toISOString(),
            diasDesdeUltima: Math.max(0, diffDays),
        });
    }
    catch (error) {
        const code = error && typeof error === "object" && "code" in error
            ? String(error.code ?? "")
            : "";
        if (code === "PLATFORM_SATISFACTION_TABLE_MISSING") {
            throw new httpError_1.HttpError(400, "Banco sem suporte a pesquisa de satisfacao da plataforma. Execute a migration da TPESQUISA_SATISFACAO_PLATAFORMA.");
        }
        throw error;
    }
});
exports.submitPlatformSatisfaction = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf, nivelSatisfacao, nivel, respondidoEm } = req.body;
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf ?? "");
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    const parsedNivel = parseNivel(nivelSatisfacao ?? nivel);
    const respondidoDate = respondidoEm ? new Date(respondidoEm) : new Date();
    if (Number.isNaN(respondidoDate.getTime())) {
        throw new httpError_1.HttpError(400, "respondidoEm invalido");
    }
    try {
        const result = await (0, platformSatisfactionModel_1.createPlatformSatisfaction)({
            cpf: cpfDigits,
            nivelSatisfacao: parsedNivel,
            respondidoEm: respondidoDate,
        });
        res.status(201).json({ respondidoEm: result.respondidoEm.toISOString() });
    }
    catch (error) {
        const code = error && typeof error === "object" && "code" in error
            ? String(error.code ?? "")
            : "";
        if (code === "PLATFORM_SATISFACTION_TABLE_MISSING") {
            throw new httpError_1.HttpError(400, "Banco sem suporte a pesquisa de satisfacao da plataforma. Execute a migration da TPESQUISA_SATISFACAO_PLATAFORMA.");
        }
        throw error;
    }
});
exports.getTrainingFeedbackDashboardSummary = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const [eficaciaRows, satisfacaoRows, horasColetivoRows, horasIndividualRows] = await Promise.all([
        (0, userTrainingModel_1.getTrainingEficaciaSummary)(),
        (0, platformSatisfactionModel_1.getPlatformSatisfactionSummary)(),
        (0, turmaModel_1.getCollectiveTrainingHoursMonthlySummaryLast12Months)(),
        (0, userTrainingModel_1.getIndividualTrainingHoursMonthlySummaryLast12Months)(),
    ]);
    const monthTemplate = buildLast12MonthsTemplate();
    const coletivoMap = new Map();
    for (const row of horasColetivoRows) {
        const key = `${Number(row.ANO)}-${String(Number(row.MES)).padStart(2, "0")}`;
        coletivoMap.set(key, toNumber(row.TOTAL_HORAS));
    }
    const individualMap = new Map();
    for (const row of horasIndividualRows) {
        const key = `${Number(row.ANO)}-${String(Number(row.MES)).padStart(2, "0")}`;
        individualMap.set(key, toNumber(row.TOTAL_HORAS));
    }
    const horasColetivoSerie = monthTemplate.keys.map((key) => Number((coletivoMap.get(key) ?? 0).toFixed(2)));
    const horasIndividualSerie = monthTemplate.keys.map((key) => Number((individualMap.get(key) ?? 0).toFixed(2)));
    res.json({
        eficacia: {
            total: eficaciaRows.reduce((sum, row) => sum + Number(row.TOTAL ?? 0), 0),
            counts: eficaciaRows.map((row) => ({
                nivel: Number(row.NIVEL),
                total: Number(row.TOTAL ?? 0),
            })),
        },
        satisfacao: {
            total: satisfacaoRows.reduce((sum, row) => sum + Number(row.TOTAL ?? 0), 0),
            counts: satisfacaoRows.map((row) => ({
                nivel: Number(row.NIVEL_SATISFACAO),
                total: Number(row.TOTAL ?? 0),
            })),
        },
        horasTreinamento12Meses: {
            labels: monthTemplate.labels,
            ministradoInstrutorHoras: horasColetivoSerie,
            assistidoIndividualHoras: horasIndividualSerie,
            totais: {
                ministradoInstrutorHoras: Number(horasColetivoSerie.reduce((sum, value) => sum + value, 0).toFixed(2)),
                assistidoIndividualHoras: Number(horasIndividualSerie.reduce((sum, value) => sum + value, 0).toFixed(2)),
            },
        },
    });
});
