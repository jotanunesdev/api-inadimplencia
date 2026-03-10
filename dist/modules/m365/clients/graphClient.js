"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphClient = exports.GraphClient = void 0;
const env_1 = require("../config/env");
const tokenService_1 = require("../services/tokenService");
const errors_1 = require("../types/errors");
const graphUrl_1 = require("../utils/graphUrl");
const logger_1 = require("../utils/logger");
const fetchWithTimeout_1 = require("../utils/fetchWithTimeout");
async function parseGraphErrorResponse(response) {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        try {
            const payload = (await response.json());
            return {
                code: payload.error?.code,
                message: payload.error?.message ||
                    `Microsoft Graph respondeu com status ${response.status}.`,
            };
        }
        catch (_error) {
            return {
                message: `Microsoft Graph respondeu com status ${response.status}.`,
            };
        }
    }
    const rawText = await response.text();
    return {
        message: rawText || `Microsoft Graph respondeu com status ${response.status}.`,
    };
}
class GraphClient {
    async getJson(pathOrUrl) {
        const response = await this.executeRequest(pathOrUrl, 'application/json');
        return (await response.json());
    }
    async getBinary(pathOrUrl) {
        const response = await this.executeRequest(pathOrUrl, 'application/octet-stream');
        return {
            buffer: await response.arrayBuffer(),
            contentType: response.headers.get('content-type'),
        };
    }
    async executeRequest(pathOrUrl, accept) {
        const accessToken = await (0, tokenService_1.getAccessToken)();
        const url = (0, graphUrl_1.buildGraphUrl)(env_1.env.GRAPH_BASE_URL, pathOrUrl);
        logger_1.logger.info('GraphClient', `GET ${url}`);
        const response = await (0, fetchWithTimeout_1.fetchWithTimeout)(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: accept,
            },
        }, env_1.env.HTTP_TIMEOUT_MS);
        if (response.ok) {
            return response;
        }
        const graphError = await parseGraphErrorResponse(response);
        const details = {
            status: response.status,
            code: graphError.code,
            message: graphError.message,
        };
        logger_1.logger.warn('GraphClient', 'Falha em requisicao ao Microsoft Graph.', details);
        if (response.status === 401) {
            throw new errors_1.AppError(401, 'Falha de autenticacao com o Microsoft Graph.', 'GRAPH_UNAUTHORIZED', details);
        }
        if (response.status === 403) {
            throw new errors_1.AppError(403, 'Permissao insuficiente para acessar o Microsoft Graph.', 'GRAPH_FORBIDDEN', details);
        }
        if (response.status === 404) {
            throw new errors_1.AppError(404, graphError.message, 'GRAPH_NOT_FOUND', details);
        }
        if (response.status === 429) {
            throw new errors_1.AppError(429, 'Limite de requisicoes do Microsoft Graph atingido. Tente novamente em instantes.', 'GRAPH_RATE_LIMIT', {
                ...details,
                retryAfter: response.headers.get('retry-after'),
            });
        }
        throw new errors_1.AppError(response.status >= 500 ? 502 : response.status, graphError.message, 'GRAPH_REQUEST_FAILED', details);
    }
}
exports.GraphClient = GraphClient;
exports.graphClient = new GraphClient();
