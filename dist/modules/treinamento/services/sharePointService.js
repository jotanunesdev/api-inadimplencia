"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSharePointEnabled = isSharePointEnabled;
exports.ensureSharePointFolder = ensureSharePointFolder;
exports.buildSharePointFilePath = buildSharePointFilePath;
exports.createSharePointUploadSession = createSharePointUploadSession;
exports.getSharePointFileByPath = getSharePointFileByPath;
exports.getSharePointItemByPath = getSharePointItemByPath;
exports.listSharePointFolderChildren = listSharePointFolderChildren;
exports.getSharePointItemById = getSharePointItemById;
exports.listSharePointFolderChildrenByItemId = listSharePointFolderChildrenByItemId;
exports.createSharePointFolder = createSharePointFolder;
exports.updateSharePointItemName = updateSharePointItemName;
exports.downloadSharePointFileContentByPath = downloadSharePointFileContentByPath;
exports.downloadSharePointFileContentByItemId = downloadSharePointFileContentByItemId;
exports.copySharePointItemToFolder = copySharePointItemToFolder;
exports.uploadFileToSharePoint = uploadFileToSharePoint;
exports.uploadBase64ToSharePoint = uploadBase64ToSharePoint;
exports.deleteSharePointFileByUrl = deleteSharePointFileByUrl;
exports.deleteSharePointFileByPath = deleteSharePointFileByPath;
exports.deleteSharePointItemById = deleteSharePointItemById;
exports.downloadSharePointFileByUrl = downloadSharePointFileByUrl;
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
let tokenCache = null;
let driveContextCache = null;
const SHAREPOINT_CHUNK_GRANULARITY = 320 * 1024;
const SHAREPOINT_MAX_CHUNK_SIZE = 60 * 1024 * 1024;
const SHAREPOINT_UPLOAD_CHUNK_SIZE = (() => {
    const requestedBytes = env_1.env.SP_UPLOAD_CHUNK_MB * 1024 * 1024;
    const rounded = Math.floor(requestedBytes / SHAREPOINT_CHUNK_GRANULARITY) *
        SHAREPOINT_CHUNK_GRANULARITY;
    const normalized = Math.max(SHAREPOINT_CHUNK_GRANULARITY, rounded);
    return Math.min(normalized, SHAREPOINT_MAX_CHUNK_SIZE);
})();
function normalizePath(value) {
    return value
        .replace(/\\/g, "/")
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join("/");
}
function joinPaths(...parts) {
    return parts
        .map((item) => item ?? "")
        .map((item) => normalizePath(item))
        .filter(Boolean)
        .join("/");
}
function encodeDrivePath(path) {
    return normalizePath(path)
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}
function getSharePointConfig() {
    const enabled = env_1.env.SHAREPOINT_ENABLED;
    if (!enabled) {
        return null;
    }
    const tenantId = env_1.env.SHAREPOINT_TENANT_ID?.trim();
    const clientId = env_1.env.SHAREPOINT_CLIENT_ID?.trim();
    const clientSecret = env_1.env.SHAREPOINT_CLIENT_SECRET?.trim();
    const siteUrl = env_1.env.SHAREPOINT_SITE_URL?.trim();
    if (!tenantId || !clientId || !clientSecret || !siteUrl) {
        throw new Error("SharePoint habilitado, mas SP_TENANT_ID/SP_CLIENT_ID/SP_CLIENT_SECRET/SP_SITE_URL nao foram configurados");
    }
    return {
        tenantId,
        clientId,
        clientSecret,
        siteUrl,
        libraryName: env_1.env.SHAREPOINT_LIBRARY_NAME.trim(),
        rootFolder: normalizePath(env_1.env.SHAREPOINT_ROOT_FOLDER),
    };
}
function isSharePointEnabled() {
    return env_1.env.SHAREPOINT_ENABLED;
}
async function getAccessToken() {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const now = Date.now();
    if (tokenCache && tokenCache.expiresAt > now) {
        return tokenCache.value;
    }
    const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: "https://graph.microsoft.com/.default",
    });
    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    if (!response.ok) {
        const payload = await response.text();
        throw new Error(`Falha ao autenticar no SharePoint (${response.status}): ${payload}`);
    }
    const json = (await response.json());
    if (!json.access_token) {
        throw new Error("Token de acesso do SharePoint nao foi retornado");
    }
    const expiresInSeconds = Number(json.expires_in ?? 3600);
    tokenCache = {
        value: json.access_token,
        expiresAt: now + Math.max(60, expiresInSeconds - 120) * 1000,
    };
    return tokenCache.value;
}
async function graphRequest(path, init = {}, okStatus = [200]) {
    const token = await getAccessToken();
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...init.headers,
        },
    });
    if (!okStatus.includes(response.status)) {
        const payload = await response.text();
        throw new Error(`Erro no SharePoint Graph (${response.status}) em ${path}: ${payload}`);
    }
    if (response.status === 204) {
        return null;
    }
    return (await response.json());
}
async function graphBinaryRequest(path, init = {}, okStatus = [200]) {
    const token = await getAccessToken();
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            ...init.headers,
        },
    });
    if (!okStatus.includes(response.status)) {
        const payload = await response.text();
        throw new Error(`Erro no SharePoint Graph (${response.status}) em ${path}: ${payload}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
async function uploadChunkToUploadUrl(params) {
    const response = await fetch(params.uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Length": String(params.buffer.length),
            "Content-Range": `bytes ${params.start}-${params.end}/${params.total}`,
            "Content-Type": "application/octet-stream",
        },
        body: params.buffer,
    });
    if (![200, 201, 202].includes(response.status)) {
        const payload = await response.text();
        throw new Error(`Erro no upload em partes SharePoint (${response.status}): ${payload}`);
    }
    if (response.status === 202) {
        return null;
    }
    return (await response.json());
}
async function getDriveContext() {
    if (driveContextCache) {
        return driveContextCache;
    }
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const parsedSiteUrl = new URL(config.siteUrl);
    const hostname = parsedSiteUrl.hostname;
    const sitePath = parsedSiteUrl.pathname.replace(/\/$/, "");
    const site = await graphRequest(`/sites/${hostname}:${sitePath}?$select=id`);
    if (!site?.id) {
        throw new Error("Site do SharePoint nao encontrado");
    }
    const drivesPayload = await graphRequest(`/sites/${site.id}/drives?$select=id,name,webUrl`);
    const expectedLibrary = config.libraryName.trim().toLocaleLowerCase();
    const drive = drivesPayload.value.find((item) => {
        const byName = item.name.trim().toLocaleLowerCase() === expectedLibrary;
        if (byName) {
            return true;
        }
        if (!item.webUrl) {
            return false;
        }
        try {
            const drivePath = decodeURIComponent(new URL(item.webUrl).pathname);
            const segments = drivePath.split("/").filter(Boolean);
            const librarySegment = segments[segments.length - 1]?.trim().toLocaleLowerCase();
            return librarySegment === expectedLibrary;
        }
        catch {
            return false;
        }
    });
    if (!drive) {
        throw new Error(`Biblioteca '${config.libraryName}' nao encontrada no site SharePoint`);
    }
    driveContextCache = {
        siteId: site.id,
        driveId: drive.id,
    };
    return driveContextCache;
}
async function createFolderIfMissing(parentPath, name) {
    const { driveId } = await getDriveContext();
    const endpoint = parentPath
        ? `/drives/${driveId}/root:/${encodeDrivePath(parentPath)}:/children`
        : `/drives/${driveId}/root/children`;
    try {
        await graphRequest(endpoint, {
            method: "POST",
            body: JSON.stringify({
                name,
                folder: {},
                "@microsoft.graph.conflictBehavior": "fail",
            }),
        }, [200, 201]);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("nameAlreadyExists") ||
            message.includes("already exists") ||
            message.includes("(409)")) {
            return;
        }
        throw error;
    }
}
function buildDriveItemSelect() {
    return [
        "id",
        "name",
        "webUrl",
        "size",
        "createdDateTime",
        "lastModifiedDateTime",
        "createdBy",
        "lastModifiedBy",
        "parentReference",
        "file",
        "folder",
    ].join(",");
}
async function ensureSharePointFolder(relativeFolderPath) {
    const config = getSharePointConfig();
    if (!config) {
        return;
    }
    const fullPath = joinPaths(config.rootFolder, relativeFolderPath);
    const segments = fullPath.split("/").filter(Boolean);
    let current = "";
    for (const segment of segments) {
        // eslint-disable-next-line no-await-in-loop
        await createFolderIfMissing(current, segment);
        current = current ? `${current}/${segment}` : segment;
    }
}
function buildSharePointFilePath(params) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const safeFileName = params.fileName
        .replace(/\//g, "_")
        .replace(/\\/g, "_")
        .trim();
    if (!safeFileName) {
        throw new Error("Nome de arquivo invalido para upload no SharePoint");
    }
    const fullPath = joinPaths(config.rootFolder, params.relativeFolderPath, safeFileName);
    return {
        safeFileName,
        fullPath,
    };
}
async function createSharePointUploadSession(params) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { driveId } = await getDriveContext();
    await ensureSharePointFolder(params.relativeFolderPath);
    const { safeFileName, fullPath } = buildSharePointFilePath(params);
    const createSessionPath = `/drives/${driveId}/root:/${encodeDrivePath(fullPath)}:/createUploadSession`;
    const uploadSession = await graphRequest(createSessionPath, {
        method: "POST",
        body: JSON.stringify({
            item: {
                "@microsoft.graph.conflictBehavior": "replace",
                name: safeFileName,
            },
        }),
    }, [200, 201]);
    const uploadUrl = uploadSession.uploadUrl?.trim();
    if (!uploadUrl) {
        throw new Error("SharePoint nao retornou uploadUrl para upload em partes");
    }
    return {
        uploadUrl,
        fullPath,
        fileName: safeFileName,
        expiresAt: uploadSession.expirationDateTime ?? null,
    };
}
async function getSharePointFileByPath(fullPath) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { driveId } = await getDriveContext();
    const endpoint = `/drives/${driveId}/root:/${encodeDrivePath(fullPath)}?$select=${buildDriveItemSelect()}`;
    return graphRequest(endpoint, {}, [200]);
}
async function getSharePointItemByPath(relativePath) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { driveId } = await getDriveContext();
    const fullPath = joinPaths(config.rootFolder, relativePath);
    const endpoint = `/drives/${driveId}/root:/${encodeDrivePath(fullPath)}?$select=${buildDriveItemSelect()}`;
    return graphRequest(endpoint, {}, [200]);
}
async function listSharePointFolderChildren(relativeFolderPath) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { driveId } = await getDriveContext();
    const fullPath = joinPaths(config.rootFolder, relativeFolderPath);
    const endpoint = `/drives/${driveId}/root:/${encodeDrivePath(fullPath)}:/children?$select=${buildDriveItemSelect()}`;
    const response = await graphRequest(endpoint, {}, [200]);
    return response.value ?? [];
}
async function getSharePointItemById(itemId) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { driveId } = await getDriveContext();
    const endpoint = `/drives/${driveId}/items/${encodeURIComponent(itemId)}?$select=${buildDriveItemSelect()}`;
    return graphRequest(endpoint, {}, [200]);
}
async function listSharePointFolderChildrenByItemId(itemId) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { driveId } = await getDriveContext();
    const endpoint = `/drives/${driveId}/items/${encodeURIComponent(itemId)}/children?$select=${buildDriveItemSelect()}`;
    const response = await graphRequest(endpoint, {}, [200]);
    return response.value ?? [];
}
async function createSharePointFolder(params) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { driveId } = await getDriveContext();
    await ensureSharePointFolder(params.relativeParentFolderPath);
    const fullParentPath = joinPaths(config.rootFolder, params.relativeParentFolderPath);
    const endpoint = `/drives/${driveId}/root:/${encodeDrivePath(fullParentPath)}:/children`;
    return graphRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
            name: params.name,
            folder: {},
            "@microsoft.graph.conflictBehavior": "fail",
        }),
    }, [200, 201]);
}
async function updateSharePointItemName(params) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { driveId } = await getDriveContext();
    const endpoint = `/drives/${driveId}/items/${encodeURIComponent(params.itemId)}`;
    return graphRequest(endpoint, {
        method: "PATCH",
        body: JSON.stringify({
            name: params.name,
        }),
    }, [200]);
}
async function downloadSharePointFileContentByPath(params) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { driveId } = await getDriveContext();
    const suffix = params.format ? `?format=${encodeURIComponent(params.format)}` : "";
    const endpoint = `/drives/${driveId}/root:/${encodeDrivePath(params.fullPath)}:/content${suffix}`;
    return graphBinaryRequest(endpoint, {}, [200]);
}
async function downloadSharePointFileContentByItemId(params) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { driveId } = await getDriveContext();
    const suffix = params.format ? `?format=${encodeURIComponent(params.format)}` : "";
    const endpoint = `/drives/${driveId}/items/${encodeURIComponent(params.itemId)}/content${suffix}`;
    return graphBinaryRequest(endpoint, {}, [200]);
}
async function copySharePointItemToFolder(params) {
    const ext = path_1.default.extname(params.fileName || "") || ".bin";
    const tempFilePath = path_1.default.join(os_1.default.tmpdir(), `sp-copy-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    const buffer = await downloadSharePointFileContentByItemId({
        itemId: params.itemId,
    });
    await promises_1.default.writeFile(tempFilePath, buffer);
    return uploadFileToSharePoint({
        tempFilePath,
        relativeFolderPath: params.relativeFolderPath,
        fileName: params.fileName,
        contentType: params.contentType,
    });
}
async function uploadFileToSharePoint(params) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    const { uploadUrl, fileName: safeFileName } = await createSharePointUploadSession({
        relativeFolderPath: params.relativeFolderPath,
        fileName: params.fileName,
    });
    const fileStat = await promises_1.default.stat(params.tempFilePath);
    const totalSize = fileStat.size;
    if (totalSize <= 0) {
        throw new Error("Arquivo de upload vazio");
    }
    const fileHandle = await promises_1.default.open(params.tempFilePath, "r");
    let uploaded = null;
    try {
        let offset = 0;
        while (offset < totalSize) {
            const chunkLength = Math.min(SHAREPOINT_UPLOAD_CHUNK_SIZE, totalSize - offset);
            const chunkBuffer = Buffer.allocUnsafe(chunkLength);
            const { bytesRead } = await fileHandle.read(chunkBuffer, 0, chunkLength, offset);
            if (bytesRead <= 0) {
                break;
            }
            const chunk = bytesRead === chunkBuffer.length
                ? chunkBuffer
                : chunkBuffer.subarray(0, bytesRead);
            const start = offset;
            const end = offset + bytesRead - 1;
            // eslint-disable-next-line no-await-in-loop
            const result = await uploadChunkToUploadUrl({
                uploadUrl,
                start,
                end,
                total: totalSize,
                buffer: chunk,
            });
            if (result) {
                uploaded = result;
                break;
            }
            offset = end + 1;
        }
    }
    finally {
        await fileHandle.close().catch(() => undefined);
        await promises_1.default.unlink(params.tempFilePath).catch(() => undefined);
    }
    if (!uploaded) {
        throw new Error("Upload para SharePoint nao foi concluido");
    }
    if (!uploaded.webUrl) {
        throw new Error("Upload para SharePoint concluido sem webUrl de retorno");
    }
    return {
        webUrl: uploaded.webUrl,
        itemId: uploaded.id,
        name: uploaded.name,
    };
}
function extensionFromMimeType(mimeType) {
    const normalized = mimeType.trim().toLowerCase();
    if (normalized === "image/jpeg" || normalized === "image/jpg")
        return ".jpg";
    if (normalized === "image/png")
        return ".png";
    if (normalized === "image/webp")
        return ".webp";
    return ".bin";
}
function parseBase64Payload(base64Input) {
    const trimmed = base64Input.trim();
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
        return {
            mimeType: match[1].trim().toLowerCase(),
            payload: match[2].replace(/\s+/g, ""),
        };
    }
    return {
        mimeType: "application/octet-stream",
        payload: trimmed.replace(/\s+/g, ""),
    };
}
async function uploadBase64ToSharePoint(params) {
    const parsed = parseBase64Payload(params.base64Data);
    const mimeType = params.contentType?.trim() || parsed.mimeType;
    const ext = extensionFromMimeType(mimeType);
    const safePrefix = params.fileNamePrefix
        .replace(/[^\w.-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80) || "face";
    const fileName = `${safePrefix}-${Date.now()}${ext}`;
    const tempFilePath = path_1.default.join(os_1.default.tmpdir(), `sp-face-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    let buffer;
    try {
        buffer = Buffer.from(parsed.payload, "base64");
    }
    catch {
        throw new Error("Foto base64 invalida para upload no SharePoint");
    }
    if (!buffer.length) {
        throw new Error("Foto base64 vazia para upload no SharePoint");
    }
    await promises_1.default.writeFile(tempFilePath, buffer);
    return uploadFileToSharePoint({
        tempFilePath,
        relativeFolderPath: params.relativeFolderPath,
        fileName,
        contentType: mimeType,
    });
}
async function deleteSharePointFileByUrl(fileUrl) {
    const config = getSharePointConfig();
    if (!config) {
        return;
    }
    if (!fileUrl.startsWith("http")) {
        return;
    }
    const parsedFileUrl = new URL(fileUrl);
    const parsedSiteUrl = new URL(config.siteUrl);
    if (parsedFileUrl.hostname.toLocaleLowerCase() !==
        parsedSiteUrl.hostname.toLocaleLowerCase()) {
        return;
    }
    const sitePath = decodeURIComponent(parsedSiteUrl.pathname).replace(/\/$/, "");
    const pathname = decodeURIComponent(parsedFileUrl.pathname);
    const libraryPrefix = `${sitePath}/${config.libraryName}/`;
    const pathnameLower = pathname.toLocaleLowerCase();
    const prefixLower = libraryPrefix.toLocaleLowerCase();
    if (!pathnameLower.startsWith(prefixLower)) {
        return;
    }
    const relativePath = pathname.slice(libraryPrefix.length);
    const { driveId } = await getDriveContext();
    const endpoint = `/drives/${driveId}/root:/${encodeDrivePath(relativePath)}`;
    try {
        await graphRequest(endpoint, { method: "DELETE" }, [204, 404]);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("(404)")) {
            return;
        }
        throw error;
    }
}
async function deleteSharePointFileByPath(fullPath) {
    const config = getSharePointConfig();
    if (!config) {
        return;
    }
    const { driveId } = await getDriveContext();
    const endpoint = `/drives/${driveId}/root:/${encodeDrivePath(fullPath)}`;
    try {
        await graphRequest(endpoint, { method: "DELETE" }, [204, 404]);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("(404)")) {
            return;
        }
        throw error;
    }
}
async function deleteSharePointItemById(itemId) {
    const config = getSharePointConfig();
    if (!config) {
        return;
    }
    const { driveId } = await getDriveContext();
    const endpoint = `/drives/${driveId}/items/${encodeURIComponent(itemId)}`;
    try {
        await graphRequest(endpoint, { method: "DELETE" }, [204, 404]);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("(404)")) {
            return;
        }
        throw error;
    }
}
async function downloadSharePointFileByUrl(fileUrl, format) {
    const config = getSharePointConfig();
    if (!config) {
        throw new Error("SharePoint nao habilitado");
    }
    if (!fileUrl.startsWith("http")) {
        throw new Error("URL de arquivo SharePoint invalida");
    }
    const parsedFileUrl = new URL(fileUrl);
    const parsedSiteUrl = new URL(config.siteUrl);
    if (parsedFileUrl.hostname.toLocaleLowerCase() !==
        parsedSiteUrl.hostname.toLocaleLowerCase()) {
        throw new Error("URL do arquivo nao pertence ao site SharePoint configurado");
    }
    const sitePath = decodeURIComponent(parsedSiteUrl.pathname).replace(/\/$/, "");
    const pathname = decodeURIComponent(parsedFileUrl.pathname);
    const libraryPrefix = `${sitePath}/${config.libraryName}/`;
    const pathnameLower = pathname.toLocaleLowerCase();
    const prefixLower = libraryPrefix.toLocaleLowerCase();
    if (!pathnameLower.startsWith(prefixLower)) {
        throw new Error("URL do arquivo nao pertence a biblioteca SharePoint configurada");
    }
    const relativePath = pathname.slice(libraryPrefix.length);
    return downloadSharePointFileContentByPath({ fullPath: relativePath, format });
}
