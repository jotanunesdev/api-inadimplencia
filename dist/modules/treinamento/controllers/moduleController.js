"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.update = exports.create = exports.getById = exports.list = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const moduleModel_1 = require("../models/moduleModel");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const storage_1 = require("../utils/storage");
const pathUpdateModel_1 = require("../models/pathUpdateModel");
exports.list = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf } = req.query;
    const modules = cpf
        ? await (0, moduleModel_1.listModulesByUser)((0, normalizeCpf_1.normalizeCpf)(cpf))
        : await (0, moduleModel_1.listModules)();
    res.json({ modules });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const module = await (0, moduleModel_1.getModuleById)(req.params.id);
    if (!module) {
        throw new httpError_1.HttpError(404, "Modulo nao encontrado");
    }
    res.json({ module });
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, nome, qtdTrilhas, criadoPor, path } = req.body;
    if (!id || !nome) {
        throw new httpError_1.HttpError(400, "ID e nome sao obrigatorios");
    }
    const modulePath = (0, storage_1.buildModuleRelativePath)(nome);
    await (0, storage_1.ensurePublicDir)(modulePath);
    const module = await (0, moduleModel_1.createModule)({
        id,
        nome,
        qtdTrilhas,
        criadoPor,
        path: path ?? modulePath,
    });
    res.status(201).json({ module });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { nome, qtdTrilhas, criadoPor, path } = req.body;
    if (nome === undefined &&
        qtdTrilhas === undefined &&
        criadoPor === undefined &&
        path === undefined) {
        throw new httpError_1.HttpError(400, "Informe ao menos um campo para atualizar");
    }
    const current = await (0, moduleModel_1.getModuleById)(req.params.id);
    if (!current) {
        throw new httpError_1.HttpError(404, "Modulo nao encontrado");
    }
    const currentPath = current.PATH ?? (0, storage_1.buildModuleRelativePath)(current.NOME);
    let nextPath = currentPath;
    if (nome && nome.trim() !== current.NOME) {
        nextPath = (0, storage_1.buildModuleRelativePath)(nome);
        if (nextPath !== currentPath) {
            await (0, storage_1.renameDirectory)(currentPath, nextPath);
            await (0, pathUpdateModel_1.updateTrilhaPathsByPrefix)(currentPath, nextPath);
            await (0, pathUpdateModel_1.updateMaterialPathsByPrefix)(currentPath, nextPath);
        }
    }
    else if (!current.PATH) {
        await (0, storage_1.ensurePublicDir)(currentPath);
    }
    const shouldUpdatePath = !current.PATH || nextPath !== currentPath;
    const module = await (0, moduleModel_1.updateModule)(req.params.id, {
        nome,
        qtdTrilhas,
        criadoPor,
        path: shouldUpdatePath ? nextPath : undefined,
    });
    if (!module) {
        throw new httpError_1.HttpError(404, "Modulo nao encontrado");
    }
    res.json({ module });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    try {
        await (0, moduleModel_1.deleteModule)(req.params.id);
    }
    catch (error) {
        const requestError = error;
        const message = requestError?.originalError?.info?.message ?? requestError?.message ?? "";
        if (requestError?.number === 547 && message.includes("FK_TTRILHAS_MODULO")) {
            throw new httpError_1.HttpError(409, "Nao e possivel excluir o modulo porque existem trilhas vinculadas. Exclua as trilhas do modulo primeiro.");
        }
        throw error;
    }
    res.status(204).send();
});
