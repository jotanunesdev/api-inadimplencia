"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = exports.listCourses = exports.listCandidates = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const dossieService_1 = require("../services/dossieService");
const dossieModel_1 = require("../models/dossieModel");
exports.listCandidates = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const candidates = await (0, dossieModel_1.listDossieCandidates)();
    res.json({ candidates });
});
exports.listCourses = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const normalizedCpf = (0, normalizeCpf_1.normalizeCpf)(String(req.params.cpf ?? ""));
    if (!normalizedCpf) {
        throw new httpError_1.HttpError(400, "cpf e obrigatorio");
    }
    const courses = await (0, dossieService_1.listDossieSelectableCoursesByCpf)(normalizedCpf);
    res.json({ courses });
});
exports.generate = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf, usuarioEmissor, UsuarioEmissor, obra, Obra, setorObra, SetorObra, cursosSelecionados, CursosSelecionados } = (req.body ?? {});
    const normalizedCpf = (0, normalizeCpf_1.normalizeCpf)(String(cpf ?? ""));
    if (!normalizedCpf) {
        throw new httpError_1.HttpError(400, "cpf e obrigatorio");
    }
    const selectedCoursesInput = CursosSelecionados ?? cursosSelecionados;
    const parsedSelectedCourses = Array.isArray(selectedCoursesInput)
        ? selectedCoursesInput
            .map((item) => {
            if (!item || typeof item !== "object")
                return null;
            const source = item;
            const tipoRaw = String(source.tipo ?? "").trim().toLowerCase();
            const itemId = String(source.itemId ?? "").trim();
            const trilhaId = String(source.trilhaId ?? "").trim();
            if ((tipoRaw !== "norma" && tipoRaw !== "procedimento") || !itemId || !trilhaId) {
                return null;
            }
            return {
                tipo: tipoRaw,
                itemId,
                trilhaId,
            };
        })
            .filter((item) => Boolean(item))
        : null;
    const dossie = await (0, dossieService_1.generateDossiePdfForCpf)(normalizedCpf, {
        usuarioEmissor: (() => {
            const value = UsuarioEmissor ?? usuarioEmissor;
            return typeof value === "string" && value.trim() ? value.trim() : null;
        })(),
        obra: (() => {
            const value = Obra ?? obra;
            return typeof value === "string" && value.trim() ? value.trim() : null;
        })(),
        setorObra: (() => {
            const value = SetorObra ?? setorObra;
            return typeof value === "string" && value.trim() ? value.trim() : null;
        })(),
        cursosSelecionados: parsedSelectedCourses,
    });
    res.status(201).json({ dossie });
});
