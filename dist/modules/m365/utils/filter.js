"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseListUsersQuery = parseListUsersQuery;
exports.parseFindUserByUsernameQuery = parseFindUserByUsernameQuery;
exports.buildUsersFilter = buildUsersFilter;
exports.buildUsernameLookupFilter = buildUsernameLookupFilter;
const errors_1 = require("../types/errors");
function parseBooleanValue(value, fieldName) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
        return true;
    }
    if (normalized === 'false') {
        return false;
    }
    throw new errors_1.AppError(400, `Query param '${fieldName}' deve ser true ou false.`, 'INVALID_QUERY_PARAM');
}
function parseBooleanQueryValue(value, fieldName, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    return parseBooleanValue(String(value), fieldName);
}
function normalizeOptionalString(value) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : undefined;
}
function escapeFilterValue(value) {
    return value.replace(/'/g, "''");
}
function parseListUsersQuery(query) {
    return {
        includePhoto: parseBooleanQueryValue(query.includePhoto, 'includePhoto', false) ?? false,
        department: normalizeOptionalString(query.department),
        accountEnabled: parseBooleanQueryValue(query.accountEnabled, 'accountEnabled'),
    };
}
function parseFindUserByUsernameQuery(query) {
    return {
        includePhoto: parseBooleanQueryValue(query.includePhoto, 'includePhoto', true) ?? true,
    };
}
function buildUsersFilter(query) {
    const filters = [];
    if (query.department) {
        filters.push(`department eq '${escapeFilterValue(query.department)}'`);
    }
    if (typeof query.accountEnabled === 'boolean') {
        filters.push(`accountEnabled eq ${String(query.accountEnabled)}`);
    }
    return filters.length > 0 ? filters.join(' and ') : undefined;
}
function buildUsernameLookupFilter(username) {
    const normalizedUsername = String(username ?? '').trim().toLowerCase();
    const escapedUsername = escapeFilterValue(normalizedUsername);
    const escapedEmailPrefix = escapeFilterValue(`${normalizedUsername}@`);
    return [
        `mailNickname eq '${escapedUsername}'`,
        `startswith(userPrincipalName,'${escapedEmailPrefix}')`,
        `startswith(mail,'${escapedEmailPrefix}')`,
    ].join(' or ');
}
