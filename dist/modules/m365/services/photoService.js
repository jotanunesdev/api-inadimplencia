"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserPhotoById = getUserPhotoById;
const graphClient_1 = require("../clients/graphClient");
const errors_1 = require("../types/errors");
const base64_1 = require("../utils/base64");
async function getUserPhotoById(userId, options = {}) {
    const normalizedUserId = String(userId ?? '').trim();
    if (!normalizedUserId) {
        throw new errors_1.AppError(400, 'O id do usuario e obrigatorio.', 'INVALID_USER_ID');
    }
    try {
        const photoResponse = await graphClient_1.graphClient.getBinary(`/users/${encodeURIComponent(normalizedUserId)}/photo/$value`);
        return {
            base64: (0, base64_1.arrayBufferToBase64)(photoResponse.buffer),
            contentType: photoResponse.contentType,
        };
    }
    catch (error) {
        if (error instanceof errors_1.AppError && error.statusCode === 404) {
            if (options.throwOnMissing) {
                throw new errors_1.AppError(404, 'Foto de perfil nao encontrada para o usuario informado.', 'USER_PHOTO_NOT_FOUND');
            }
            return null;
        }
        throw error;
    }
}
