"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureConfigured = void 0;
const env_1 = require("../config/env");
const errors_1 = require("../types/errors");
const ensureConfigured = (_req, _res, next) => {
    if (env_1.env.isConfigured) {
        next();
        return;
    }
    next(new errors_1.AppError(500, (0, env_1.buildMissingConfigMessage)(), 'M365_NOT_CONFIGURED', {
        missingRequired: env_1.env.missingRequired,
    }));
};
exports.ensureConfigured = ensureConfigured;
