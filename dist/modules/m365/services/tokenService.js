"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = getAccessToken;
const env_1 = require("../config/env");
const errors_1 = require("../types/errors");
const fetchWithTimeout_1 = require("../utils/fetchWithTimeout");
const logger_1 = require("../utils/logger");
let cachedToken = null;
async function parseTokenError(response) {
    try {
        const payload = (await response.json());
        return (payload.error_description ||
            payload.error ||
            `Falha ao obter token do Microsoft Graph (${response.status}).`);
    }
    catch (_error) {
        return `Falha ao obter token do Microsoft Graph (${response.status}).`;
    }
}
async function getAccessToken() {
    if (!env_1.env.isConfigured) {
        throw new errors_1.AppError(500, (0, env_1.buildMissingConfigMessage)(), 'M365_NOT_CONFIGURED', {
            missingRequired: env_1.env.missingRequired,
        });
    }
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
        logger_1.logger.info('TokenService', 'Token Microsoft Graph obtido do cache em memoria.');
        return cachedToken.accessToken;
    }
    logger_1.logger.info('TokenService', 'Solicitando novo token Microsoft Graph.');
    const tokenUrl = `https://login.microsoftonline.com/${env_1.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env_1.env.AZURE_CLIENT_ID,
        client_secret: env_1.env.AZURE_CLIENT_SECRET,
        scope: env_1.env.GRAPH_SCOPE,
    });
    const response = await (0, fetchWithTimeout_1.fetchWithTimeout)(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    }, env_1.env.HTTP_TIMEOUT_MS);
    if (!response.ok) {
        const message = await parseTokenError(response);
        logger_1.logger.error('TokenService', 'Falha ao obter token Microsoft Graph.', {
            status: response.status,
            message,
        });
        throw new errors_1.AppError(401, message, 'GRAPH_TOKEN_REQUEST_FAILED');
    }
    const tokenPayload = (await response.json());
    cachedToken = {
        accessToken: tokenPayload.access_token,
        expiresAt: Date.now() + tokenPayload.expires_in * 1000 - env_1.env.TOKEN_CACHE_BUFFER_MS,
    };
    return tokenPayload.access_token;
}
