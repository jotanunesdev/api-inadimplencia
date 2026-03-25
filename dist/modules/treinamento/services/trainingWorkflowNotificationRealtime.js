"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastTrainingWorkflowNotificationSnapshot = broadcastTrainingWorkflowNotificationSnapshot;
exports.openTrainingWorkflowNotificationStream = openTrainingWorkflowNotificationStream;
const trainingWorkflowNotificationModel_1 = require("../models/trainingWorkflowNotificationModel");
const sectorAccess_1 = require("../utils/sectorAccess");
const STREAM_RETRY_MS = 3000;
const STREAM_HEARTBEAT_MS = 15000;
const STREAM_EVENT_NAME = "training-workflow-notifications.snapshot";
const listenersByUsername = new Map();
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
async function broadcastTrainingWorkflowNotificationSnapshot(username) {
    const normalizedUsername = (0, sectorAccess_1.normalizeUsernameValue)(username);
    const listeners = listenersByUsername.get(normalizedUsername);
    if (!normalizedUsername || !listeners?.size) {
        return;
    }
    const snapshot = await (0, trainingWorkflowNotificationModel_1.getTrainingWorkflowNotificationSnapshot)({
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
async function openTrainingWorkflowNotificationStream(request, response, username) {
    const normalizedUsername = (0, sectorAccess_1.normalizeUsernameValue)(username);
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();
    response.write(`retry: ${STREAM_RETRY_MS}\n\n`);
    let isClosed = false;
    const pushSnapshot = async () => {
        const snapshot = await (0, trainingWorkflowNotificationModel_1.getTrainingWorkflowNotificationSnapshot)({
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
