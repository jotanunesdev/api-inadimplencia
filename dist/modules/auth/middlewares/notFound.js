"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
function notFound(_req, res) {
    res.status(404).json({
        message: 'Endpoint nao encontrado',
        code: 'NOT_FOUND',
    });
}
