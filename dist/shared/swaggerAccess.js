"use strict";
const DEFAULT_CORS_OPTIONS = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
function normalizeOrigin(origin) {
    return String(origin ?? '').trim().toLowerCase();
}
function isOriginAllowed(origin, env) {
    const normalized = normalizeOrigin(origin);
    if (!normalized) {
        return false;
    }
    return env.CORS_ALLOW_ALL || env.CORS_ORIGINS.includes(normalized);
}
function isSwaggerRequest(req) {
    const requestPath = String(req.originalUrl ?? req.url ?? req.path ?? '').toLowerCase();
    const referer = String(req.headers.referer ?? req.headers.referrer ?? '').toLowerCase();
    const swaggerMarkers = ['/docs', '/docs-json', '/api/docs', '/api/docs.json', 'swagger'];
    return swaggerMarkers.some((marker) => requestPath.includes(marker) || referer.includes(marker));
}
function isRequestAllowed(req, env) {
    if (isSwaggerRequest(req)) {
        return true;
    }
    if (!normalizeOrigin(req.headers.origin)) {
        return true;
    }
    return isOriginAllowed(req.headers.origin, env);
}
function createCorsOptionsDelegate(env) {
    return (req, callback) => {
        callback(null, {
            ...DEFAULT_CORS_OPTIONS,
            origin: isRequestAllowed(req, env),
        });
    };
}
module.exports = {
    DEFAULT_CORS_OPTIONS,
    createCorsOptionsDelegate,
    isRequestAllowed,
    isSwaggerRequest,
};
