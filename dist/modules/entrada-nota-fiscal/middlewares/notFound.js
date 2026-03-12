"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
function notFound(_req, res) {
    res.status(404).json({
        success: false,
        error: {
            code: 'ENTRY_INVOICE_ROUTE_NOT_FOUND',
            message: 'Endpoint de Entrada de Nota Fiscal nao encontrado.',
        },
    });
}
