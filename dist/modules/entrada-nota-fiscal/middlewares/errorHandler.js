"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const errors_1 = require("../types/errors");
function errorHandler(error, _req, res, _next) {
    if (error instanceof errors_1.AppError) {
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
    if (error instanceof Error) {
        res.status(500).json({
            success: false,
            error: {
                code: 'ENTRY_INVOICE_INTERNAL_SERVER_ERROR',
                message: error.message,
            },
        });
        return;
    }
    res.status(500).json({
        success: false,
        error: {
            code: 'ENTRY_INVOICE_INTERNAL_SERVER_ERROR',
            message: 'Erro interno do modulo Entrada de Nota Fiscal.',
        },
    });
}
