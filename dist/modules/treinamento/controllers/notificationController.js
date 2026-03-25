"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsUnread = exports.markAsRead = exports.list = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const notificationModel_1 = require("../models/notificationModel");
function parseStatusFilter(raw) {
    const value = String(raw ?? "").trim().toLowerCase();
    if (!value)
        return "pendente";
    if (value === "pendente" || value === "lida" || value === "todas") {
        return value;
    }
    throw new httpError_1.HttpError(400, "status invalido. Use: pendente, lida ou todas");
}
function parseLookaheadDays(raw) {
    if (raw === undefined || raw === null || String(raw).trim() === "") {
        return 7;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new httpError_1.HttpError(400, "lookaheadDays invalido");
    }
    return Math.trunc(parsed);
}
const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
exports.list = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { status, lookaheadDays } = req.query;
    const parsedStatus = parseStatusFilter(status);
    const parsedLookahead = parseLookaheadDays(lookaheadDays);
    const generated = await (0, notificationModel_1.generateNormaExpiryNotifications)(parsedLookahead);
    const notifications = await (0, notificationModel_1.listNormaExpiryNotifications)(parsedStatus);
    res.json({ notifications, generated });
});
exports.markAsRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    if (!GUID_REGEX.test(id)) {
        throw new httpError_1.HttpError(400, "id invalido");
    }
    const updated = await (0, notificationModel_1.markNormaExpiryNotificationAsRead)(id, true);
    if (!updated) {
        throw new httpError_1.HttpError(404, "Notificacao nao encontrada");
    }
    res.status(204).send();
});
exports.markAsUnread = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    if (!GUID_REGEX.test(id)) {
        throw new httpError_1.HttpError(400, "id invalido");
    }
    const updated = await (0, notificationModel_1.markNormaExpiryNotificationAsRead)(id, false);
    if (!updated) {
        throw new httpError_1.HttpError(404, "Notificacao nao encontrada");
    }
    res.status(204).send();
});
