"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const errors_1 = require("../types/errors");
const logger_1 = require("../utils/logger");
function errorHandler(error, _req, res, _next) {
    if (error instanceof errors_1.AppError) {
        logger_1.logger.warn('M365ErrorHandler', error.message, {
            code: error.code,
            statusCode: error.statusCode,
            details: error.details,
        });
        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
        });
        return;
    }
    logger_1.logger.error('M365ErrorHandler', 'Erro nao tratado no modulo M365.', error);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erro interno do servidor.',
        },
    });
}
