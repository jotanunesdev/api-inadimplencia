"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const errors_1 = require("../types/errors");
function errorHandler(error, _req, res, _next) {
    if (error instanceof errors_1.AppError) {
        res.status(error.statusCode).json({
            message: error.message,
            code: error.code,
            details: error.details,
        });
        return;
    }
    console.error('Unhandled auth module error:', error);
    res.status(500).json({
        message: 'Erro interno',
        code: 'INTERNAL_SERVER_ERROR',
    });
}
