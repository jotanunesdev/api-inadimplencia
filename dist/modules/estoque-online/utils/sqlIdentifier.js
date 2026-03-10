"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteSqlIdentifier = quoteSqlIdentifier;
const errors_1 = require("../types/errors");
const SQL_IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
function quoteSqlIdentifier(identifier) {
    if (!SQL_IDENTIFIER_REGEX.test(identifier)) {
        throw new errors_1.AppError(500, `Identificador SQL invalido: ${identifier}.`, 'INVALID_SQL_IDENTIFIER');
    }
    return `[${identifier}]`;
}
