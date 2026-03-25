"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllProfileFeedNotificationsAsRead = exports.markProfileFeedNotificationAsRead = exports.streamProfileFeedNotifications = exports.listProfileFeedNotifications = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const profileNotificationModel_1 = require("../models/profileNotificationModel");
const profileNotificationRealtime_1 = require("../services/profileNotificationRealtime");
const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const normalizeUsername = (value) => String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.trim() ?? "";
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
    return normalizeUsername(String(req.query.username ?? req.body?.username ?? ""));
}
exports.listProfileFeedNotifications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const username = readUsernameFromRequest(req);
    const status = parseStatusFilter(req.query.status);
    const limit = parseLimit(req.query.limit);
    if (!username) {
        throw new httpError_1.HttpError(400, "username e obrigatorio");
    }
    const snapshot = await (0, profileNotificationModel_1.getProfileNotificationSnapshot)({
        username,
        status,
        limit,
    });
    res.json(snapshot);
});
exports.streamProfileFeedNotifications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const username = readUsernameFromRequest(req);
    if (!username) {
        throw new httpError_1.HttpError(400, "username e obrigatorio");
    }
    await (0, profileNotificationRealtime_1.openProfileNotificationStream)(req, res, username);
});
exports.markProfileFeedNotificationAsRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = String(req.params.id ?? "").trim();
    const username = readUsernameFromRequest(req);
    if (!GUID_REGEX.test(id)) {
        throw new httpError_1.HttpError(400, "id invalido");
    }
    if (!username) {
        throw new httpError_1.HttpError(400, "username e obrigatorio");
    }
    const updated = await (0, profileNotificationModel_1.setProfileNotificationReadState)({
        id,
        read: true,
        username,
    });
    if (!updated) {
        throw new httpError_1.HttpError(404, "Notificacao nao encontrada");
    }
    await (0, profileNotificationRealtime_1.broadcastProfileNotificationSnapshot)(username);
    res.status(204).send();
});
exports.markAllProfileFeedNotificationsAsRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const username = readUsernameFromRequest(req);
    if (!username) {
        throw new httpError_1.HttpError(400, "username e obrigatorio");
    }
    await (0, profileNotificationModel_1.markAllProfileNotificationsAsRead)(username);
    await (0, profileNotificationRealtime_1.broadcastProfileNotificationSnapshot)(username);
    res.status(204).send();
});
