"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOrganizationUsers = listOrganizationUsers;
exports.findOrganizationUserByUsername = findOrganizationUserByUsername;
const env_1 = require("../config/env");
const graph_1 = require("../config/graph");
const graphClient_1 = require("../clients/graphClient");
const filter_1 = require("../utils/filter");
const graphUrl_1 = require("../utils/graphUrl");
const logger_1 = require("../utils/logger");
const concurrency_1 = require("../utils/concurrency");
const photoService_1 = require("./photoService");
const errors_1 = require("../types/errors");
function normalizeGraphUser(user) {
    return {
        id: user.id,
        displayName: user.displayName ?? null,
        givenName: user.givenName ?? null,
        surname: user.surname ?? null,
        mail: user.mail ?? null,
        userPrincipalName: user.userPrincipalName ?? null,
        jobTitle: user.jobTitle ?? null,
        department: user.department ?? null,
        officeLocation: user.officeLocation ?? null,
        mobilePhone: user.mobilePhone ?? null,
        businessPhones: Array.isArray(user.businessPhones) ? user.businessPhones : [],
        preferredLanguage: user.preferredLanguage ?? null,
        accountEnabled: typeof user.accountEnabled === 'boolean' ? user.accountEnabled : null,
        employeeId: user.employeeId ?? null,
        city: user.city ?? null,
        state: user.state ?? null,
        country: user.country ?? null,
        companyName: user.companyName ?? null,
        photo: null,
    };
}
function normalizeSearchValue(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
function matchesSearch(user, search) {
    const normalizedSearch = normalizeSearchValue(search);
    if (!normalizedSearch) {
        return true;
    }
    const searchableValues = [
        user.displayName,
        user.givenName,
        user.surname,
        user.mail,
        user.userPrincipalName,
        user.jobTitle,
        user.department,
    ];
    return searchableValues.some((value) => normalizeSearchValue(value).includes(normalizedSearch));
}
function extractUsernameCandidate(value) {
    const normalizedValue = String(value ?? '').trim().toLowerCase();
    if (!normalizedValue) {
        return '';
    }
    return normalizedValue.split('@')[0] ?? normalizedValue;
}
function matchesUsername(user, username) {
    const normalizedUsername = String(username ?? '').trim().toLowerCase();
    if (!normalizedUsername) {
        return false;
    }
    const candidates = [
        extractUsernameCandidate(user.userPrincipalName),
        extractUsernameCandidate(user.mail),
    ].filter(Boolean);
    return candidates.includes(normalizedUsername);
}
async function listOrganizationUsers(query) {
    const filter = (0, filter_1.buildUsersFilter)(query);
    const users = [];
    let pagesFetched = 0;
    let nextUrl = (0, graphUrl_1.buildGraphUrl)(env_1.env.GRAPH_BASE_URL, '/users', {
        $select: graph_1.GRAPH_USER_SELECT,
        $top: graph_1.GRAPH_DEFAULT_PAGE_SIZE,
        $filter: filter,
    });
    while (nextUrl) {
        const page = await graphClient_1.graphClient.getJson(nextUrl);
        users.push(...page.value.map(normalizeGraphUser));
        pagesFetched += 1;
        nextUrl = page['@odata.nextLink'] ?? '';
    }
    logger_1.logger.info('UserService', 'Usuarios carregados do Microsoft Graph.', {
        totalUsers: users.length,
        pagesFetched,
        includePhoto: query.includePhoto,
        filter,
        search: query.search ?? null,
        page: query.page,
        pageSize: query.pageSize,
    });
    const filteredUsers = users.filter((user) => matchesSearch(user, query.search));
    const totalAvailable = users.length;
    const totalMatched = filteredUsers.length;
    const pageSize = query.pageSize;
    const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
    const page = Math.min(query.page, totalPages);
    const startIndex = (page - 1) * pageSize;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);
    if (!query.includePhoto || paginatedUsers.length === 0) {
        return {
            users: paginatedUsers,
            filter: filter ?? null,
            pagesFetched,
            totalAvailable,
            totalMatched,
            page,
            pageSize,
            totalPages,
        };
    }
    const usersWithPhotos = await (0, concurrency_1.mapWithConcurrency)(paginatedUsers, env_1.env.PHOTO_CONCURRENCY_LIMIT, async (user) => {
        try {
            const photo = await (0, photoService_1.getUserPhotoById)(user.id);
            return {
                ...user,
                photo,
            };
        }
        catch (error) {
            logger_1.logger.warn('UserService', `Falha ao buscar foto do usuario ${user.id}.`, error);
            return user;
        }
    });
    return {
        users: usersWithPhotos,
        filter: filter ?? null,
        pagesFetched,
        totalAvailable,
        totalMatched,
        page,
        pageSize,
        totalPages,
    };
}
async function findOrganizationUserByUsername(username, query) {
    const normalizedUsername = String(username ?? '').trim().toLowerCase();
    if (!normalizedUsername) {
        throw new errors_1.AppError(400, 'O username do usuario e obrigatorio.', 'INVALID_USERNAME');
    }
    const filter = (0, filter_1.buildUsernameLookupFilter)(normalizedUsername);
    const lookupUrl = (0, graphUrl_1.buildGraphUrl)(env_1.env.GRAPH_BASE_URL, '/users', {
        $select: graph_1.GRAPH_USER_SELECT,
        $top: 25,
        $filter: filter,
    });
    const page = await graphClient_1.graphClient.getJson(lookupUrl);
    const candidates = page.value.map(normalizeGraphUser);
    const matchedUser = candidates.find((user) => matchesUsername(user, normalizedUsername)) ??
        candidates[0];
    if (!matchedUser) {
        throw new errors_1.AppError(404, 'Usuario nao encontrado no Microsoft 365 para o username informado.', 'M365_USER_NOT_FOUND');
    }
    if (!query.includePhoto) {
        return {
            user: matchedUser,
            filter,
        };
    }
    try {
        const photo = (await (0, photoService_1.getUserPhotoById)(matchedUser.userPrincipalName ?? matchedUser.id)) ??
            null;
        return {
            user: {
                ...matchedUser,
                photo,
            },
            filter,
        };
    }
    catch (error) {
        logger_1.logger.warn('UserService', `Falha ao buscar foto do usuario ${matchedUser.id} durante lookup.`, error);
        return {
            user: matchedUser,
            filter,
        };
    }
}
