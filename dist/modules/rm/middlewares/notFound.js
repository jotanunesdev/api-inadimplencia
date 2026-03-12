"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
function notFound(_req, res) {
    res.status(404).json({
        success: false,
        error: {
            code: 'RM_ROUTE_NOT_FOUND',
            message: 'Endpoint RM nao encontrado.',
        },
    });
}
