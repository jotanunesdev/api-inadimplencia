"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllTrainingWorkflowNotificationsRead = exports.markTrainingWorkflowNotificationAsRead = exports.streamTrainingWorkflowNotifications = exports.listTrainingWorkflowNotifications = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const trainingWorkflowNotificationModel_1 = require("../models/trainingWorkflowNotificationModel");
const trainingWorkflowNotificationRealtime_1 = require("../services/trainingWorkflowNotificationRealtime");
const sectorAccess_1 = require("../utils/sectorAccess");
const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function parseStatusFilter(raw) {
    const value = String(raw ?? "").trim().toLowerCase();
    if (!value)
        return "todas";
    if (value === "pendente" || value === "lida" || value === "todas") {
        return value;
    }
    throw new httpError_1.HttpError(400, "status invalido. Use: pendente, lida ou todas");
}
function parseLimit(raw) {
    if (raw === undefined || raw === null || String(raw).trim() === "") {
        return 10;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new httpError_1.HttpError(400, "limit invalido");
    }
    return Math.trunc(parsed);
}
function readUsernameFromRequest(req) {
    return (0, sectorAccess_1.normalizeUsernameValue)(String(req.query.username ?? req.body?.username ?? ""));
}
exports.listTrainingWorkflowNotifications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const username = readUsernameFromRequest(req);
    const status = parseStatusFilter(req.query.status);
    const limit = parseLimit(req.query.limit);
    if (!username) {
        throw new httpError_1.HttpError(400, "username e obrigatorio");
    }
    const snapshot = await (0, trainingWorkflowNotificationModel_1.getTrainingWorkflowNotificationSnapshot)({
        username,
        status,
        limit,
    });
    res.json(snapshot);
});
exports.streamTrainingWorkflowNotifications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const username = readUsernameFromRequest(req);
    if (!username) {
        throw new httpError_1.HttpError(400, "username e obrigatorio");
    }
    await (0, trainingWorkflowNotificationRealtime_1.openTrainingWorkflowNotificationStream)(req, res, username);
});
exports.markTrainingWorkflowNotificationAsRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = String(req.params.id ?? "").trim();
    const username = readUsernameFromRequest(req);
    if (!GUID_REGEX.test(id)) {
        throw new httpError_1.HttpError(400, "id invalido");
    }
    if (!username) {
        throw new httpError_1.HttpError(400, "username e obrigatorio");
    }
    const updated = await (0, trainingWorkflowNotificationModel_1.setTrainingWorkflowNotificationReadState)({
        id,
        read: true,
        username,
    });
    if (!updated) {
        throw new httpError_1.HttpError(404, "Notificacao nao encontrada");
    }
    await (0, trainingWorkflowNotificationRealtime_1.broadcastTrainingWorkflowNotificationSnapshot)(username);
    res.status(204).send();
});
exports.markAllTrainingWorkflowNotificationsRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const username = readUsernameFromRequest(req);
    if (!username) {
        throw new httpError_1.HttpError(400, "username e obrigatorio");
    }
    await (0, trainingWorkflowNotificationModel_1.markAllTrainingWorkflowNotificationsAsRead)(username);
    await (0, trainingWorkflowNotificationRealtime_1.broadcastTrainingWorkflowNotificationSnapshot)(username);
    res.status(204).send();
});
