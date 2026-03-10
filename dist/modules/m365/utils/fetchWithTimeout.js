"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWithTimeout = fetchWithTimeout;
const errors_1 = require("../types/errors");
async function fetchWithTimeout(url, init, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new errors_1.AppError(504, 'Tempo limite excedido ao comunicar com o Microsoft Graph.', 'GRAPH_TIMEOUT');
        }
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}
