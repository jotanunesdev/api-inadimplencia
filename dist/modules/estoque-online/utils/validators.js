"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCompositeKey = parseCompositeKey;
exports.parseEstoqueMinPayload = parseEstoqueMinPayload;
const errors_1 = require("../types/errors");
function normalizeString(value, fieldName) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
        throw new errors_1.AppError(400, `O campo '${fieldName}' e obrigatorio.`, 'INVALID_PARAM');
    }
    return normalized;
}
function parseCompositeKey(source) {
    return {
        codigoPrd: normalizeString(source.codigoPrd, 'codigoPrd'),
        codFilial: normalizeString(source.codFilial, 'codFilial'),
        codLoc: normalizeString(source.codLoc, 'codLoc'),
    };
}
function parseEstoqueMinPayload(source) {
    const rawValue = source.estoqueMin;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        throw new errors_1.AppError(400, "O campo 'estoqueMin' deve ser um numero maior ou igual a zero.", 'INVALID_BODY');
    }
    return {
        estoqueMin: numericValue,
    };
}
