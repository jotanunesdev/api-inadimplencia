"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.update = exports.create = exports.getById = exports.list = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const channelModel_1 = require("../models/channelModel");
const storage_1 = require("../utils/storage");
const sharePointService_1 = require("../services/sharePointService");
exports.list = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const channels = await (0, channelModel_1.listChannels)();
    res.json({ channels });
});
exports.getById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const channel = await (0, channelModel_1.getChannelById)(req.params.id);
    if (!channel) {
        throw new httpError_1.HttpError(404, "Canal nao encontrado");
    }
    res.json({ channel });
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, nome, criadoPor, path } = req.body;
    if (!id || !nome) {
        throw new httpError_1.HttpError(400, "ID e nome sao obrigatorios");
    }
    const channelPath = (0, storage_1.buildChannelRelativePath)(nome);
    if ((0, sharePointService_1.isSharePointEnabled)()) {
        await (0, sharePointService_1.ensureSharePointFolder)(channelPath);
    }
    else {
        await (0, storage_1.ensurePublicDir)(channelPath);
    }
    const channel = await (0, channelModel_1.createChannel)({
        id,
        nome,
        criadoPor,
        path: path ?? channelPath,
    });
    res.status(201).json({ channel });
});
exports.update = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { nome, criadoPor, path } = req.body;
    if (nome === undefined && criadoPor === undefined && path === undefined) {
        throw new httpError_1.HttpError(400, "Informe ao menos um campo para atualizar");
    }
    const channel = await (0, channelModel_1.updateChannel)(req.params.id, {
        nome,
        criadoPor,
        path,
    });
    if (!channel) {
        throw new httpError_1.HttpError(404, "Canal nao encontrado");
    }
    res.json({ channel });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await (0, channelModel_1.deleteChannel)(req.params.id);
    res.status(204).send();
});
