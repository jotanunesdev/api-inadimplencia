"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProcedimentoVersionReport = exports.listObraTrainingOverview = exports.listObraTrainedReport = exports.listObraPendingTrainingsReport = exports.listUserTrainingsReport = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const reportModel_1 = require("../models/reportModel");
function parseOptionalDate(value, fieldName) {
    if (value === undefined || value === null || String(value).trim() === "") {
        return null;
    }
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
        throw new httpError_1.HttpError(400, `${fieldName} invalida`);
    }
    return parsed;
}
exports.listUserTrainingsReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cpf = (0, normalizeCpf_1.normalizeCpf)(String(req.query.cpf ?? ""));
    if (cpf.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    const report = await (0, reportModel_1.listUserTrainingStatusReport)(cpf);
    res.json({ report });
});
exports.listObraPendingTrainingsReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const obra = String(req.query.obra ?? "").trim() || null;
    if (!obra) {
        throw new httpError_1.HttpError(400, "obra e obrigatoria");
    }
    const report = await (0, reportModel_1.listObraTrainingStatusReport)({
        obraNome: obra,
        apenasPendentes: true,
    });
    res.json({ report });
});
exports.listObraTrainedReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const obra = String(req.query.obra ?? "").trim() || null;
    if (!obra) {
        throw new httpError_1.HttpError(400, "obra e obrigatoria");
    }
    const report = await (0, reportModel_1.listObraTrainingStatusReport)({
        obraNome: obra,
        apenasConcluidos: true,
    });
    res.json({ report });
});
exports.listObraTrainingOverview = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const report = await (0, reportModel_1.listObraTrainingOverviewReport)();
    res.json({ report });
});
exports.listProcedimentoVersionReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const inicio = parseOptionalDate(req.query.inicio, "data inicio");
    const fim = parseOptionalDate(req.query.fim, "data fim");
    if (inicio && fim && inicio.getTime() > fim.getTime()) {
        throw new httpError_1.HttpError(400, "data inicio deve ser menor ou igual a data fim");
    }
    const report = await (0, reportModel_1.listProcedimentoVersionChangesReport)({ inicio, fim });
    res.json(report);
});
