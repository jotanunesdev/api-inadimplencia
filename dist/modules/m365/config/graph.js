"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRAPH_USER_SELECT = exports.GRAPH_USER_SELECT_FIELDS = exports.GRAPH_DEFAULT_PAGE_SIZE = exports.GRAPH_DEFAULT_TOKEN_BUFFER_MS = exports.GRAPH_DEFAULT_PHOTO_CONCURRENCY = exports.GRAPH_DEFAULT_TIMEOUT_MS = exports.GRAPH_DEFAULT_SCOPE = exports.GRAPH_DEFAULT_BASE_URL = void 0;
exports.GRAPH_DEFAULT_BASE_URL = 'https://graph.microsoft.com/v1.0';
exports.GRAPH_DEFAULT_SCOPE = 'https://graph.microsoft.com/.default';
exports.GRAPH_DEFAULT_TIMEOUT_MS = 15000;
exports.GRAPH_DEFAULT_PHOTO_CONCURRENCY = 5;
exports.GRAPH_DEFAULT_TOKEN_BUFFER_MS = 60000;
exports.GRAPH_DEFAULT_PAGE_SIZE = 999;
exports.GRAPH_USER_SELECT_FIELDS = [
    'id',
    'displayName',
    'givenName',
    'surname',
    'mail',
    'userPrincipalName',
    'jobTitle',
    'department',
    'officeLocation',
    'mobilePhone',
    'businessPhones',
    'preferredLanguage',
    'accountEnabled',
    'employeeId',
    'city',
    'state',
    'country',
    'companyName',
];
exports.GRAPH_USER_SELECT = exports.GRAPH_USER_SELECT_FIELDS.join(',');
