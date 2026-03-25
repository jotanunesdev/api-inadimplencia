"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.update = exports.create = exports.getById = exports.list = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const trainingMatrixModel_1 = require("../models/trainingMatrixModel");
exports.list = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cargo } = req.query;
    const items = await (0, trainingMatrixModel_1.listTrainingMatrix)(cargo);
    res.json({ items });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const item = await (0, trainingMatrixModel_1.getTrainingMatrixById)(req.params.id);
    if (!item) {
        throw new httpError_1.HttpError(404, "Treinamento nao encontrado");
    }
    res.json({ item });
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, cargoFk, cursoId, qtdHoras, titulo, provaBase64 } = req.body;
    if (!id || !cargoFk || !cursoId) {
        throw new httpError_1.HttpError(400, "ID, cargoFk e cursoId sao obrigatorios");
    }
    const provaBuffer = provaBase64 ? Buffer.from(provaBase64, "base64") : null;
    const item = await (0, trainingMatrixModel_1.createTrainingMatrix)({
        id,
        cargoFk,
        cursoId,
        qtdHoras,
        titulo,
        prova: provaBuffer,
    });
    res.status(201).json({ item });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cargoFk, cursoId, qtdHoras, titulo, provaBase64 } = req.body;
    if (!cargoFk || !cursoId) {
        throw new httpError_1.HttpError(400, "cargoFk e cursoId sao obrigatorios");
    }
    const provaBuffer = provaBase64 ? Buffer.from(provaBase64, "base64") : null;
    const item = await (0, trainingMatrixModel_1.updateTrainingMatrix)(req.params.id, {
        cargoFk,
        cursoId,
        qtdHoras,
        titulo,
        prova: provaBuffer,
    });
    if (!item) {
        throw new httpError_1.HttpError(404, "Treinamento nao encontrado");
    }
    res.json({ item });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await (0, trainingMatrixModel_1.deleteTrainingMatrix)(req.params.id);
    res.status(204).send();
});
