"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reactToMessage = exports.postMessage = exports.listMessages = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const profileMessageModel_1 = require("../models/profileMessageModel");
const profileNotificationModel_1 = require("../models/profileNotificationModel");
const profileNotificationRealtime_1 = require("../services/profileNotificationRealtime");
const normalizeUsername = (value) => String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.trim() ?? "";
async function broadcastNotificationRecipients(usernames) {
    const recipients = Array.from(new Set(usernames.map((value) => normalizeUsername(value)).filter(Boolean)));
    await Promise.all(recipients.map((username) => (0, profileNotificationRealtime_1.broadcastProfileNotificationSnapshot)(username).catch(() => { })));
}
exports.listMessages = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const profileUsername = normalizeUsername(String(req.query.profileUsername ?? ""));
    const viewerUsername = normalizeUsername(String(req.query.viewerUsername ?? ""));
    if (!profileUsername) {
        throw new httpError_1.HttpError(400, "profileUsername e obrigatorio");
    }
    const messages = await (0, profileMessageModel_1.listProfileMessages)({
        profileUsername,
        viewerUsername,
    });
    res.json({ messages });
});
exports.postMessage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { authorJobTitle, authorName, authorUsername, content, parentId, profileUsername, } = (req.body ?? {});
    const normalizedProfileUsername = normalizeUsername(profileUsername);
    const normalizedAuthorUsername = normalizeUsername(authorUsername);
    const normalizedContent = String(content ?? "").trim();
    const normalizedParentId = String(parentId ?? "").trim() || null;
    if (!normalizedProfileUsername) {
        throw new httpError_1.HttpError(400, "profileUsername e obrigatorio");
    }
    if (!normalizedAuthorUsername) {
        throw new httpError_1.HttpError(400, "authorUsername e obrigatorio");
    }
    if (!normalizedContent) {
        throw new httpError_1.HttpError(400, "content e obrigatorio");
    }
    if (normalizedContent.length > 4000) {
        throw new httpError_1.HttpError(400, "content excede o limite de 4000 caracteres");
    }
    try {
        const id = await (0, profileMessageModel_1.createProfileMessage)({
            authorJobTitle,
            authorName,
            authorUsername: normalizedAuthorUsername,
            content: normalizedContent,
            parentId: normalizedParentId,
            profileUsername: normalizedProfileUsername,
        });
        const recipientsToBroadcast = new Set();
        const profileNotification = await (0, profileNotificationModel_1.createProfileNotification)({
            authorJobTitle,
            authorName,
            authorUsername: normalizedAuthorUsername,
            messageId: id,
            messageParentId: normalizedParentId,
            recipientUsername: normalizedProfileUsername,
            targetProfileUsername: normalizedProfileUsername,
            type: normalizedParentId ? "reply" : "new_message",
        });
        if (profileNotification) {
            recipientsToBroadcast.add(profileNotification.profileUsername);
        }
        if (normalizedParentId) {
            const parentMessage = await (0, profileMessageModel_1.getProfileMessageById)(normalizedParentId);
            const parentAuthorUsername = normalizeUsername(parentMessage?.authorUsername);
            if (parentAuthorUsername &&
                parentAuthorUsername !== normalizedProfileUsername) {
                const authorMessageNotification = await (0, profileNotificationModel_1.createProfileNotification)({
                    authorJobTitle,
                    authorName,
                    authorUsername: normalizedAuthorUsername,
                    messageId: id,
                    messageParentId: normalizedParentId,
                    recipientUsername: parentAuthorUsername,
                    targetProfileUsername: normalizedProfileUsername,
                    type: "message_reply",
                });
                if (authorMessageNotification) {
                    recipientsToBroadcast.add(authorMessageNotification.profileUsername);
                }
            }
        }
        if (recipientsToBroadcast.size > 0) {
            void broadcastNotificationRecipients(Array.from(recipientsToBroadcast));
        }
        res.status(201).json({ id });
    }
    catch (error) {
        if (error instanceof Error &&
            error.message === "PROFILE_MESSAGE_PARENT_NOT_FOUND") {
            throw new httpError_1.HttpError(404, "Mensagem pai nao encontrada para este perfil");
        }
        throw error;
    }
});
exports.reactToMessage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const messageId = String(req.params.id ?? "").trim();
    const username = normalizeUsername(String(req.body?.username ?? ""));
    const reactionValue = String(req.body?.reaction ?? "")
        .trim()
        .toLowerCase();
    if (!messageId) {
        throw new httpError_1.HttpError(400, "id da mensagem e obrigatorio");
    }
    if (!username) {
        throw new httpError_1.HttpError(400, "username e obrigatorio");
    }
    let reaction = null;
    if (reactionValue) {
        if (reactionValue !== "like" && reactionValue !== "dislike") {
            throw new httpError_1.HttpError(400, "reaction invalida");
        }
        reaction = reactionValue;
    }
    const message = await (0, profileMessageModel_1.getProfileMessageById)(messageId);
    if (!message) {
        throw new httpError_1.HttpError(404, "Mensagem nao encontrada");
    }
    await (0, profileMessageModel_1.setProfileMessageReaction)({
        messageId,
        reaction,
        username,
    });
    if (reaction === "like") {
        const notification = await (0, profileNotificationModel_1.createProfileNotification)({
            authorUsername: username,
            messageId: message.id,
            messageParentId: message.parentId,
            recipientUsername: message.authorUsername,
            targetProfileUsername: message.profileUsername,
            type: "message_like",
        });
        if (notification) {
            void broadcastNotificationRecipients([notification.profileUsername]);
        }
    }
    res.status(204).send();
});
