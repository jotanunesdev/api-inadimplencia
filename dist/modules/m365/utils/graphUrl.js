"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraphUrl = buildGraphUrl;
function buildGraphUrl(baseUrl, pathOrUrl, query) {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
    const url = new URL(normalizedPath, normalizedBaseUrl);
    Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value === undefined || value === '') {
            return;
        }
        url.searchParams.set(key, String(value));
    });
    return url.toString();
}
