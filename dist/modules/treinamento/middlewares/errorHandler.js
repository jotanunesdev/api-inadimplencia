"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const multer_1 = __importDefault(require("multer"));
const env_1 = require("../config/env");
const httpError_1 = require("../utils/httpError");
function errorHandler(err, _req, res, _next) {
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({
                error: `Arquivo maior que o limite permitido (${env_1.env.UPLOAD_MAX_FILE_SIZE_MB} MB)`,
            });
            return;
        }
        res.status(400).json({ error: `Erro no upload: ${err.message}` });
        return;
    }
    const error = err instanceof httpError_1.HttpError ? err : null;
    const status = error?.status ?? 500;
    const message = error?.message ?? "Erro interno do servidor";
    if (status >= 500) {
        console.error(err);
    }
    res.status(status).json({ error: message });
}
