"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.update = exports.create = exports.listByUser = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const userCourseModel_1 = require("../models/userCourseModel");
const allowedStatus = new Set([
    "Nao iniciado",
    "Em andamento",
    "Concluido aprovado",
    "Concluido reprovado",
]);
exports.listByUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const courses = await (0, userCourseModel_1.listUserCourses)(req.params.cpf);
    res.json({ courses });
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, cpf, cursoId, status, dtInicio, dtConclusao } = req.body;
    if (!id || !cpf || !cursoId || !status) {
        throw new httpError_1.HttpError(400, "ID, cpf, cursoId e status sao obrigatorios");
    }
    if (!allowedStatus.has(status)) {
        throw new httpError_1.HttpError(400, "Status invalido");
    }
    await (0, userCourseModel_1.createUserCourse)({
        id,
        cpf,
        cursoId,
        status,
        dtInicio: dtInicio ? new Date(dtInicio) : null,
        dtConclusao: dtConclusao ? new Date(dtConclusao) : null,
    });
    res.status(201).json({ message: "Curso associado ao usuario" });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { status, dtInicio, dtConclusao } = req.body;
    if (!status) {
        throw new httpError_1.HttpError(400, "Status e obrigatorio");
    }
    if (!allowedStatus.has(status)) {
        throw new httpError_1.HttpError(400, "Status invalido");
    }
    await (0, userCourseModel_1.updateUserCourse)(req.params.id, {
        status,
        dtInicio: dtInicio ? new Date(dtInicio) : null,
        dtConclusao: dtConclusao ? new Date(dtConclusao) : null,
    });
    res.json({ message: "Curso atualizado" });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await (0, userCourseModel_1.deleteUserCourse)(req.params.id);
    res.status(204).send();
});
