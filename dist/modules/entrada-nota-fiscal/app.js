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
const schemaService_1 = require("./services/schemaService");
const { createCorsOptionsDelegate, isRequestAllowed } = require('../../shared/swaggerAccess');
const app = (0, express_1.default)();
const corsOptions = createCorsOptionsDelegate(env_1.env);
if (env_1.env.isConfigured) {
    (0, schemaService_1.ensureDatabaseStructure)().catch(() => {
        // health endpoint exposes initialization state
    });
}
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use((req, res, next) => {
    if (isRequestAllowed(req, env_1.env)) {
        next();
        return;
    }
    res.status(403).json({
        success: false,
        error: {
            code: 'FORBIDDEN_ORIGIN',
            message: 'Origem nao permitida.',
        },
    });
});
app.use(express_1.default.json({ limit: '10mb' }));
app.get('/health', (_req, res) => {
    const initializationState = (0, schemaService_1.getInitializationState)();
    const isHealthy = env_1.env.isConfigured && (initializationState.ready || !initializationState.lastError);
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'degraded',
        module: 'entrada-nota-fiscal',
        configured: env_1.env.isConfigured,
        missingRequired: env_1.env.missingRequired,
        initialization: initializationState,
    });
});
app.use('/entrada-nota-fiscal', routes_1.default);
app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openapi_1.default));
app.get('/docs-json', (_req, res) => res.json(openapi_1.default));
app.use(notFound_1.notFound);
app.use(errorHandler_1.errorHandler);
exports.default = app;
