"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const routes_1 = __importDefault(require("./routes"));
const env_1 = require("./config/env");
const openapi_1 = __importDefault(require("./docs/openapi"));
const errorHandler_1 = require("./middlewares/errorHandler");
const notFound_1 = require("./middlewares/notFound");
const { createCorsOptionsDelegate, isRequestAllowed } = require("../../shared/swaggerAccess");
const app = (0, express_1.default)();
const corsOptions = createCorsOptionsDelegate(env_1.env);
app.use((0, cors_1.default)(corsOptions));
app.options("*", (0, cors_1.default)(corsOptions));
app.use((req, res, next) => {
    if (isRequestAllowed(req, env_1.env)) {
        next();
        return;
    }
    res.status(403).json({ error: "Origem nao permitida." });
});
app.use(express_1.default.json({ limit: "10mb" }));
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.use("/api", routes_1.default);
app.use("/api/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openapi_1.default));
app.get("/api/docs.json", (_req, res) => res.json(openapi_1.default));
const publicRoot = path_1.default.resolve(env_1.env.PUBLIC_ASSETS_ROOT);
app.use(express_1.default.static(publicRoot));
app.use(notFound_1.notFound);
app.use(errorHandler_1.errorHandler);
exports.default = app;
