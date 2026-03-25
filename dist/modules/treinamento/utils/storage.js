"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeSegment = sanitizeSegment;
exports.buildModuleRelativePath = buildModuleRelativePath;
exports.buildTrilhaRelativePath = buildTrilhaRelativePath;
exports.buildChannelRelativePath = buildChannelRelativePath;
exports.buildProcedureRelativePath = buildProcedureRelativePath;
exports.buildNormaRelativePath = buildNormaRelativePath;
exports.toFsPath = toFsPath;
exports.ensurePublicDir = ensurePublicDir;
exports.buildStoredFileName = buildStoredFileName;
exports.moveFile = moveFile;
exports.renameDirectory = renameDirectory;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
function sanitizeSegment(value) {
    let clean = value.replace(INVALID_CHARS, "_").replace(/\s+/g, " ").trim();
    clean = clean.replace(/[. ]+$/, "");
    if (!clean) {
        clean = "sem-nome";
    }
    if (RESERVED_NAMES.test(clean)) {
        clean = `${clean}_`;
    }
    return clean;
}
function buildModuleRelativePath(nome) {
    return sanitizeSegment(nome);
}
function buildTrilhaRelativePath(modulePath, titulo) {
    return [modulePath, sanitizeSegment(titulo)].filter(Boolean).join("/");
}
function buildChannelRelativePath(nome) {
    return ["canais", sanitizeSegment(nome)].filter(Boolean).join("/");
}
function buildProcedureRelativePath() {
    return ["procedimentos"].join("/");
}
function buildNormaRelativePath() {
    return ["normas"].join("/");
}
function toFsPath(relativePath) {
    if (!relativePath) {
        return env_1.env.PUBLIC_ASSETS_ROOT;
    }
    const normalized = relativePath.replace(/\\/g, "/");
    return path_1.default.join(env_1.env.PUBLIC_ASSETS_ROOT, ...normalized.split("/"));
}
async function ensurePublicDir(relativePath) {
    const fsPath = toFsPath(relativePath);
    await promises_1.default.mkdir(fsPath, { recursive: true });
    return fsPath;
}
async function pathExists(fsPath) {
    try {
        await promises_1.default.stat(fsPath);
        return true;
    }
    catch (error) {
        const err = error;
        if (err.code === "ENOENT") {
            return false;
        }
        throw err;
    }
}
function buildStoredFileName(originalName, prefix) {
    const safeOriginal = originalName.trim() || prefix;
    const ext = path_1.default.extname(safeOriginal);
    const base = path_1.default.basename(safeOriginal, ext);
    const safeBase = sanitizeSegment(base).replace(/\s+/g, "-") || prefix;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${safeBase}-${stamp}${ext.toLowerCase()}`;
}
async function moveFile(srcPath, destPath) {
    await promises_1.default.mkdir(path_1.default.dirname(destPath), { recursive: true });
    try {
        await promises_1.default.rename(srcPath, destPath);
    }
    catch (error) {
        const err = error;
        if (err.code !== "EXDEV") {
            throw err;
        }
        await promises_1.default.copyFile(srcPath, destPath);
        await promises_1.default.unlink(srcPath);
    }
}
async function renameDirectory(oldRelativePath, newRelativePath) {
    if (!oldRelativePath || !newRelativePath) {
        return;
    }
    const oldFsPath = toFsPath(oldRelativePath);
    const newFsPath = toFsPath(newRelativePath);
    if (oldFsPath === newFsPath) {
        return;
    }
    const oldExists = await pathExists(oldFsPath);
    const newExists = await pathExists(newFsPath);
    if (newExists && oldExists) {
        throw new Error("Destino ja existe para a pasta renomeada");
    }
    if (!oldExists) {
        await promises_1.default.mkdir(newFsPath, { recursive: true });
        return;
    }
    await promises_1.default.mkdir(path_1.default.dirname(newFsPath), { recursive: true });
    try {
        await promises_1.default.rename(oldFsPath, newFsPath);
    }
    catch (error) {
        const err = error;
        if (err.code !== "EXDEV") {
            throw err;
        }
        await promises_1.default.cp(oldFsPath, newFsPath, { recursive: true });
        await promises_1.default.rm(oldFsPath, { recursive: true, force: true });
    }
}
