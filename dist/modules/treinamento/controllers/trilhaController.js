"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateShares = exports.listShares = exports.clearEficaciaConfig = exports.upsertEficaciaConfig = exports.remove = exports.update = exports.create = exports.listPendingRhEfficacy = exports.getById = exports.list = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const trilhaModel_1 = require("../models/trilhaModel");
const trilhaShareModel_1 = require("../models/trilhaShareModel");
const moduleModel_1 = require("../models/moduleModel");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const storage_1 = require("../utils/storage");
const pathUpdateModel_1 = require("../models/pathUpdateModel");
exports.list = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { moduloId, cpf } = req.query;
    if (!moduloId && !cpf) {
        throw new httpError_1.HttpError(400, "moduloId ou cpf e obrigatorio");
    }
    const trilhas = cpf
        ? await (0, trilhaModel_1.listTrilhasByUser)((0, normalizeCpf_1.normalizeCpf)(cpf), moduloId)
        : await (0, trilhaModel_1.listTrilhasByModulo)(moduloId);
    res.json({ trilhas });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const trilha = await (0, trilhaModel_1.getTrilhaById)(req.params.id);
    if (!trilha) {
        throw new httpError_1.HttpError(404, "Trilha nao encontrada");
    }
    res.json({ trilha });
});
exports.listPendingRhEfficacy = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const trilhas = await (0, trilhaModel_1.listPendingRhEfficacyTrilhas)();
    res.json({ trilhas });
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, moduloId, titulo, criadoPor, descricao, eixo, procedimentoId, normaId, atualizadoEm, path } = req.body;
    if (!id || !moduloId || !titulo) {
        throw new httpError_1.HttpError(400, "ID, moduloId e titulo sao obrigatorios");
    }
    const module = await (0, moduleModel_1.getModuleById)(moduloId);
    if (!module) {
        throw new httpError_1.HttpError(404, "Modulo nao encontrado");
    }
    const modulePath = module.PATH ?? (0, storage_1.buildModuleRelativePath)(module.NOME);
    await (0, storage_1.ensurePublicDir)(modulePath);
    const trilhaPath = (0, storage_1.buildTrilhaRelativePath)(modulePath, titulo);
    await (0, storage_1.ensurePublicDir)(trilhaPath);
    const trilha = await (0, trilhaModel_1.createTrilha)({
        id,
        moduloId,
        titulo,
        criadoPor,
        descricao,
        eixo: eixo === undefined ? undefined : String(eixo ?? "").trim() || null,
        procedimentoId: procedimentoId === undefined ? undefined : procedimentoId,
        normaId: normaId === undefined ? undefined : normaId,
        atualizadoEm: atualizadoEm ? new Date(atualizadoEm) : null,
        path: path ?? trilhaPath,
    });
    res.status(201).json({ trilha });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { moduloId, titulo, criadoPor, descricao, eixo, procedimentoId, normaId, atualizadoEm, path } = req.body;
    if (moduloId === undefined &&
        titulo === undefined &&
        criadoPor === undefined &&
        descricao === undefined &&
        eixo === undefined &&
        procedimentoId === undefined &&
        normaId === undefined &&
        atualizadoEm === undefined &&
        path === undefined) {
        throw new httpError_1.HttpError(400, "Informe ao menos um campo para atualizar");
    }
    const current = await (0, trilhaModel_1.getTrilhaById)(req.params.id);
    if (!current) {
        throw new httpError_1.HttpError(404, "Trilha nao encontrada");
    }
    const targetModuloId = moduloId ?? current.MODULO_FK_ID;
    const targetTitulo = titulo ?? current.TITULO;
    const currentModule = await (0, moduleModel_1.getModuleById)(current.MODULO_FK_ID);
    if (!currentModule) {
        throw new httpError_1.HttpError(404, "Modulo nao encontrado");
    }
    const targetModule = targetModuloId === current.MODULO_FK_ID
        ? currentModule
        : await (0, moduleModel_1.getModuleById)(targetModuloId);
    if (!targetModule) {
        throw new httpError_1.HttpError(404, "Modulo nao encontrado");
    }
    const currentModulePath = currentModule.PATH ?? (0, storage_1.buildModuleRelativePath)(currentModule.NOME);
    const currentPath = current.PATH ?? (0, storage_1.buildTrilhaRelativePath)(currentModulePath, current.TITULO);
    const targetModulePath = targetModule.PATH ?? (0, storage_1.buildModuleRelativePath)(targetModule.NOME);
    await (0, storage_1.ensurePublicDir)(targetModulePath);
    const targetPath = (0, storage_1.buildTrilhaRelativePath)(targetModulePath, targetTitulo);
    const shouldRename = targetPath !== currentPath;
    if (shouldRename) {
        await (0, storage_1.renameDirectory)(currentPath, targetPath);
        await (0, pathUpdateModel_1.updateMaterialPathsByPrefix)(currentPath, targetPath);
    }
    else if (!current.PATH) {
        await (0, storage_1.ensurePublicDir)(currentPath);
    }
    const shouldUpdatePath = !current.PATH || shouldRename;
    const trilha = await (0, trilhaModel_1.updateTrilha)(req.params.id, {
        moduloId,
        titulo,
        criadoPor,
        descricao,
        eixo: eixo === undefined ? undefined : String(eixo ?? "").trim() || null,
        procedimentoId: procedimentoId === undefined ? undefined : procedimentoId,
        normaId: normaId === undefined ? undefined : normaId,
        atualizadoEm: atualizadoEm ? new Date(atualizadoEm) : null,
        path: shouldUpdatePath ? targetPath : undefined,
    });
    if (!trilha) {
        throw new httpError_1.HttpError(404, "Trilha nao encontrada");
    }
    res.json({ trilha });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    try {
        await (0, trilhaModel_1.deleteTrilha)(req.params.id);
    }
    catch (error) {
        const requestError = error;
        const message = requestError?.originalError?.info?.message ?? requestError?.message ?? "";
        if (requestError?.number === 547) {
            throw new httpError_1.HttpError(409, "Nao e possivel excluir a trilha porque existem conteudos, provas ou vinculos associados. Remova os itens vinculados antes de excluir.");
        }
        if (message) {
            throw new httpError_1.HttpError(400, message);
        }
        throw error;
    }
    res.status(204).send();
});
exports.upsertEficaciaConfig = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { pergunta, obrigatoria } = req.body;
    const trilha = await (0, trilhaModel_1.getTrilhaById)(req.params.id);
    if (!trilha) {
        throw new httpError_1.HttpError(404, "Trilha nao encontrada");
    }
    const perguntaTrimmed = (pergunta ?? "").trim();
    if (!perguntaTrimmed) {
        throw new httpError_1.HttpError(400, "A pergunta da avaliacao de eficacia e obrigatoria");
    }
    try {
        const updated = await (0, trilhaModel_1.upsertTrilhaEficaciaConfig)(req.params.id, {
            pergunta: perguntaTrimmed,
            obrigatoria: obrigatoria !== false,
        });
        res.json({ trilha: updated });
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
});
exports.clearEficaciaConfig = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const trilha = await (0, trilhaModel_1.getTrilhaById)(req.params.id);
    if (!trilha) {
        throw new httpError_1.HttpError(404, "Trilha nao encontrada");
    }
    try {
        const updated = await (0, trilhaModel_1.clearTrilhaEficaciaConfig)(req.params.id);
        res.json({ trilha: updated });
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
});
const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
exports.listShares = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const trilha = await (0, trilhaModel_1.getTrilhaById)(req.params.id);
    if (!trilha) {
        throw new httpError_1.HttpError(404, "Trilha nao encontrada");
    }
    try {
        const shares = await (0, trilhaShareModel_1.listTrilhaSharesByTrilha)(req.params.id);
        res.json({ shares });
    }
    catch (error) {
        const code = error && typeof error === "object" && "code" in error
            ? String(error.code ?? "")
            : "";
        if (code === "TRILHA_SHARE_TABLE_MISSING") {
            res.json({ shares: [] });
            return;
        }
        throw error;
    }
});
exports.updateShares = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { moduloIds, compartilhadoPor } = req.body;
    const trilha = await (0, trilhaModel_1.getTrilhaById)(req.params.id);
    if (!trilha) {
        throw new httpError_1.HttpError(404, "Trilha nao encontrada");
    }
    if (!Array.isArray(moduloIds)) {
        throw new httpError_1.HttpError(400, "moduloIds deve ser uma lista");
    }
    const normalizedModuleIds = Array.from(new Set(moduloIds
        .map((item) => String(item ?? "").trim())
        .filter((item) => item && GUID_REGEX.test(item) && item !== trilha.MODULO_FK_ID)));
    for (const moduloId of normalizedModuleIds) {
        // eslint-disable-next-line no-await-in-loop
        const module = await (0, moduleModel_1.getModuleById)(moduloId);
        if (!module) {
            throw new httpError_1.HttpError(404, "Modulo de destino nao encontrado");
        }
    }
    try {
        const shares = await (0, trilhaShareModel_1.syncTrilhaShares)(req.params.id, normalizedModuleIds, compartilhadoPor?.trim() || null);
        res.json({ shares });
    }
    catch (error) {
        const code = error && typeof error === "object" && "code" in error
            ? String(error.code ?? "")
            : "";
        if (code === "TRILHA_SHARE_TABLE_MISSING") {
            throw new httpError_1.HttpError(400, "Banco sem suporte a compartilhamento de trilhas entre setores. Execute a migration de compartilhamento.");
        }
        throw error;
    }
});
