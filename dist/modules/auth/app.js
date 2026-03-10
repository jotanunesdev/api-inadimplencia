"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const routes_1 = __importDefault(require("./routes"));
const openapi_1 = __importDefault(require("./docs/openapi"));
const env_1 = require("./config/env");
const notFound_1 = require("./middlewares/notFound");
const errorHandler_1 = require("./middlewares/errorHandler");
const { createCorsOptionsDelegate, isRequestAllowed } = require('../../shared/swaggerAccess');
const app = (0, express_1.default)();
const corsOptions = createCorsOptionsDelegate(env_1.env);
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use((req, res, next) => {
    if (isRequestAllowed(req, env_1.env)) {
        next();
        return;
    }
    res.status(403).json({ message: 'Origem nao permitida.', code: 'FORBIDDEN_ORIGIN' });
});
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    res.status(env_1.env.isConfigured ? 200 : 503).json({
        status: env_1.env.isConfigured ? 'ok' : 'degraded',
        module: 'auth',
        configured: env_1.env.isConfigured,
        missingRequired: env_1.env.missingRequired,
    });
});
app.use('/auth', routes_1.default);
app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openapi_1.default));
app.get('/docs-json', (_req, res) => res.json(openapi_1.default));
app.use(notFound_1.notFound);
app.use(errorHandler_1.errorHandler);
exports.default = app;
