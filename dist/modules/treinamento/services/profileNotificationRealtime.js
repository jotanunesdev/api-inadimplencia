"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastProfileNotificationSnapshot = broadcastProfileNotificationSnapshot;
exports.openProfileNotificationStream = openProfileNotificationStream;
const profileNotificationModel_1 = require("../models/profileNotificationModel");
const STREAM_RETRY_MS = 3000;
const STREAM_HEARTBEAT_MS = 15000;
const STREAM_EVENT_NAME = "profile-notifications.snapshot";
const listenersByUsername = new Map();
const normalizeUsername = (value) => String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.trim() ?? "";
function serializeSseEvent(event, data) {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
function addListener(username, response) {
    const listeners = listenersByUsername.get(username) ?? new Set();
    listeners.add(response);
    listenersByUsername.set(username, listeners);
}
function removeListener(username, response) {
    const listeners = listenersByUsername.get(username);
    if (!listeners) {
        return;
    }
    listeners.delete(response);
    if (listeners.size === 0) {
        listenersByUsername.delete(username);
    }
}
async function broadcastProfileNotificationSnapshot(username) {
    const normalizedUsername = normalizeUsername(username);
    const listeners = listenersByUsername.get(normalizedUsername);
    if (!normalizedUsername || !listeners?.size) {
        return;
    }
    const snapshot = await (0, profileNotificationModel_1.getProfileNotificationSnapshot)({
        username: normalizedUsername,
    });
    const message = serializeSseEvent(STREAM_EVENT_NAME, snapshot);
    listeners.forEach((response) => {
        try {
            response.write(message);
        }
        catch {
            removeListener(normalizedUsername, response);
        }
    });
}
async function openProfileNotificationStream(request, response, username) {
    const normalizedUsername = normalizeUsername(username);
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();
    response.write(`retry: ${STREAM_RETRY_MS}\n\n`);
    let isClosed = false;
    const pushSnapshot = async () => {
        const snapshot = await (0, profileNotificationModel_1.getProfileNotificationSnapshot)({
            username: normalizedUsername,
        });
        if (!isClosed) {
            response.write(serializeSseEvent(STREAM_EVENT_NAME, snapshot));
        }
    };
    addListener(normalizedUsername, response);
    await pushSnapshot();
    const heartbeatInterval = setInterval(() => {
        if (!isClosed) {
            response.write(": ping\n\n");
        }
    }, STREAM_HEARTBEAT_MS);
    heartbeatInterval.unref?.();
    const closeStream = () => {
        if (isClosed) {
            return;
        }
        isClosed = true;
        clearInterval(heartbeatInterval);
        removeListener(normalizedUsername, response);
        response.end();
    };
    request.on("close", closeStream);
    request.on("aborted", closeStream);
}
