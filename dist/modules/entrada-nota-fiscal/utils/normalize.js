"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNullableString = toNullableString;
exports.toNullableNumber = toNullableNumber;
exports.toBoolean = toBoolean;
exports.toDateOnly = toDateOnly;
exports.roundDecimal = roundDecimal;
exports.hasValue = hasValue;
function toNullableString(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const normalized = String(value).trim();
    return normalized ? normalized : null;
}
function toNullableNumber(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return roundDecimal(value);
    }
    const rawValue = String(value).trim();
    const normalized = rawValue.includes('.') && rawValue.includes(',')
        ? rawValue.replace(/\./g, '').replace(',', '.')
        : rawValue.replace(',', '.');
    if (!normalized) {
        return null;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return roundDecimal(parsed);
}
function toBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();
    return ['true', '1', 'sim', 's', 'yes', 'y'].includes(normalized);
}
function toDateOnly(value) {
    const normalized = toNullableString(value);
    if (!normalized) {
        return null;
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed.toISOString().slice(0, 10);
}
function roundDecimal(value) {
    return Math.round(value * 10000) / 10000;
}
function hasValue(value) {
    if (value === undefined || value === null) {
        return false;
    }
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    return true;
}
