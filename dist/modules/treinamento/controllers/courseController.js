"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.update = exports.create = exports.getById = exports.list = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const courseModel_1 = require("../models/courseModel");
exports.list = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const courses = await (0, courseModel_1.listCourses)();
    res.json({ courses });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const course = await (0, courseModel_1.getCourseById)(req.params.id);
    if (!course) {
        throw new httpError_1.HttpError(404, "Curso nao encontrado");
    }
    res.json({ course });
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, titulo, descricao, duracao, materialApoio } = req.body;
    if (!id) {
        throw new httpError_1.HttpError(400, "ID do curso e obrigatorio");
    }
    const course = await (0, courseModel_1.createCourse)({
        id,
        titulo,
        descricao,
        duracao,
        materialApoio,
    });
    res.status(201).json({ course });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { titulo, descricao, duracao, materialApoio } = req.body;
    const course = await (0, courseModel_1.updateCourse)(req.params.id, {
        titulo,
        descricao,
        duracao,
        materialApoio,
    });
    if (!course) {
        throw new httpError_1.HttpError(404, "Curso nao encontrado");
    }
    res.json({ course });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await (0, courseModel_1.deleteCourse)(req.params.id);
    res.status(204).send();
});
