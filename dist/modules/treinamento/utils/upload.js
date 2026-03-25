"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const env_1 = require("../config/env");
const tmpDir = path_1.default.join(os_1.default.tmpdir(), "gestao-treinamento-uploads");
if (!fs_1.default.existsSync(tmpDir)) {
    fs_1.default.mkdirSync(tmpDir, { recursive: true });
}
const maxFileSizeBytes = env_1.env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;
exports.upload = (0, multer_1.default)({
    dest: tmpDir,
    limits: {
        fileSize: maxFileSizeBytes,
    },
});
