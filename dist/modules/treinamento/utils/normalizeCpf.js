"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCpf = normalizeCpf;
function normalizeCpf(value) {
    return value.replace(/\D/g, "");
}
