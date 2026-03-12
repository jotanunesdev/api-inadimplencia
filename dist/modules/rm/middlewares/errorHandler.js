"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(error, _req, res, _next) {
    if (error instanceof Error) {
        res.status(500).json({
            success: false,
            error: {
                code: 'RM_INTERNAL_SERVER_ERROR',
                message: error.message || 'Erro interno do modulo RM.',
            },
        });
        return;
    }
    res.status(500).json({
        success: false,
        error: {
            code: 'RM_INTERNAL_SERVER_ERROR',
            message: 'Erro interno do modulo RM.',
        },
    });
}
