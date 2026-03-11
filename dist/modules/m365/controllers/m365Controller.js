"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealth = getHealth;
exports.listUsers = listUsers;
exports.getUserPhoto = getUserPhoto;
exports.findUserByUsername = findUserByUsername;
const env_1 = require("../config/env");
const errors_1 = require("../types/errors");
const photoService_1 = require("../services/photoService");
const userService_1 = require("../services/userService");
const filter_1 = require("../utils/filter");
async function getHealth(_req, res) {
    const payload = {
        success: true,
        data: {
            status: env_1.env.isConfigured ? 'ok' : 'degraded',
            module: 'm365',
            configured: env_1.env.isConfigured,
            missingRequired: env_1.env.missingRequired,
            timestamp: new Date().toISOString(),
        },
    };
    res.status(env_1.env.isConfigured ? 200 : 503).json(payload);
}
async function listUsers(req, res) {
    const query = req.m365Query ?? {
        includePhoto: false,
        page: 1,
        pageSize: 12,
    };
    const result = await (0, userService_1.listOrganizationUsers)(query);
    res.json({
        success: true,
        data: result.users,
        meta: {
            total: result.totalMatched,
            totalAvailable: result.totalAvailable,
            currentPage: result.page,
            pageSize: result.pageSize,
            totalPages: result.totalPages,
            includePhoto: query.includePhoto,
            filters: {
                department: query.department ?? null,
                accountEnabled: typeof query.accountEnabled === 'boolean' ? query.accountEnabled : null,
                search: query.search ?? null,
            },
            graphFilter: result.filter,
            pagesFetched: result.pagesFetched,
            generatedAt: new Date().toISOString(),
        },
    });
}
async function getUserPhoto(req, res) {
    const userId = String(req.params.id ?? '').trim();
    if (!userId) {
        throw new errors_1.AppError(400, 'O id do usuario e obrigatorio.', 'INVALID_USER_ID');
    }
    const photo = await (0, photoService_1.getUserPhotoById)(userId, { throwOnMissing: true });
    if (!photo) {
        throw new errors_1.AppError(404, 'Foto de perfil nao encontrada para o usuario informado.', 'USER_PHOTO_NOT_FOUND');
    }
    res.json({
        success: true,
        data: {
            userId,
            photoBase64: photo.base64,
            contentType: photo.contentType,
            fetchedAt: new Date().toISOString(),
        },
    });
}
async function findUserByUsername(req, res) {
    const username = String(req.params.username ?? '').trim();
    if (!username) {
        throw new errors_1.AppError(400, 'O username do usuario e obrigatorio.', 'INVALID_USERNAME');
    }
    const query = (0, filter_1.parseFindUserByUsernameQuery)(req.query);
    const result = await (0, userService_1.findOrganizationUserByUsername)(username, query);
    res.json({
        success: true,
        data: result.user,
        meta: {
            includePhoto: query.includePhoto,
            graphFilter: result.filter,
            generatedAt: new Date().toISOString(),
        },
    });
}
