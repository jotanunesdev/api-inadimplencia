"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchFace = exports.enrollFace = exports.listFaces = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const userMapping_1 = require("../utils/userMapping");
const userModel_1 = require("../models/userModel");
const userFaceModel_1 = require("../models/userFaceModel");
const sharePointService_1 = require("../services/sharePointService");
const DESCRIPTOR_SIZE = 128;
const DEFAULT_MATCH_THRESHOLD = 0.5;
const DEFAULT_TOP_CANDIDATES = 5;
function parseDescriptor(raw) {
    if (!Array.isArray(raw)) {
        throw new httpError_1.HttpError(400, "descriptor deve ser um array");
    }
    if (raw.length !== DESCRIPTOR_SIZE) {
        throw new httpError_1.HttpError(400, `descriptor deve conter ${DESCRIPTOR_SIZE} posicoes`);
    }
    const descriptor = raw.map((value) => Number(value));
    if (descriptor.some((value) => !Number.isFinite(value))) {
        throw new httpError_1.HttpError(400, "descriptor contem valores invalidos");
    }
    return descriptor;
}
function parseOptionalPhoto(raw) {
    if (raw === undefined || raw === null)
        return null;
    const value = String(raw).trim();
    if (!value)
        return null;
    return value;
}
function parseOptionalUserRecord(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const record = {};
    for (const [key, value] of Object.entries(raw)) {
        if (value === null || value === undefined)
            continue;
        if (typeof value === "object")
            continue;
        const normalized = String(value).trim();
        if (!normalized)
            continue;
        record[key] = normalized;
    }
    return Object.keys(record).length ? record : null;
}
function euclideanDistance(a, b) {
    let sum = 0;
    for (let index = 0; index < a.length; index += 1) {
        const delta = a[index] - b[index];
        sum += delta * delta;
    }
    return Math.sqrt(sum);
}
exports.listFaces = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const queryCpf = req.query.cpf;
    const paramsCpf = req.params.cpf;
    const rawCpf = queryCpf ?? paramsCpf;
    const cpf = rawCpf ? (0, normalizeCpf_1.normalizeCpf)(rawCpf) : undefined;
    if (rawCpf && (!cpf || cpf.length !== 11)) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    const faces = await (0, userFaceModel_1.listUserFaces)(cpf);
    res.json({
        faces: faces.map((face) => ({
            ID: face.ID,
            USUARIO_CPF: face.USUARIO_CPF,
            USUARIO_NOME: face.USUARIO_NOME,
            FOTO_BASE64: face.FOTO_BASE64,
            FOTO_URL: face.FOTO_URL,
            ORIGEM: face.ORIGEM,
            CRIADO_POR: face.CRIADO_POR,
            CRIADO_EM: face.CRIADO_EM,
        })),
    });
});
exports.enrollFace = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf, descriptor, fotoBase64, origem, criadoPor, user, } = req.body;
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf ?? "");
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    const parsedDescriptor = parseDescriptor(descriptor);
    const parsedPhoto = parseOptionalPhoto(fotoBase64);
    const parsedOrigin = origem !== undefined ? String(origem).trim() : undefined;
    const parsedCreatedBy = criadoPor !== undefined ? String(criadoPor).trim() : undefined;
    const rawUser = parseOptionalUserRecord(user);
    if (rawUser) {
        rawUser.CPF = cpfDigits;
        const mapped = (0, userMapping_1.mapReadViewToUser)(rawUser);
        await (0, userModel_1.upsertUser)(mapped);
    }
    else {
        await (0, userModel_1.upsertUser)({ cpf: cpfDigits, ativo: true });
    }
    const previousFace = await (0, userFaceModel_1.getLatestUserFaceByCpf)(cpfDigits);
    let uploadedPhotoUrl = null;
    if (parsedPhoto) {
        if (!(0, sharePointService_1.isSharePointEnabled)()) {
            throw new httpError_1.HttpError(500, "SharePoint nao habilitado para salvar faciais. Configure TREIN_SHAREPOINT_ENABLED=true.");
        }
        await (0, sharePointService_1.ensureSharePointFolder)("faciais");
        const uploaded = await (0, sharePointService_1.uploadBase64ToSharePoint)({
            base64Data: parsedPhoto,
            relativeFolderPath: "faciais",
            fileNamePrefix: `face-${cpfDigits}`,
            contentType: "image/jpeg",
        });
        uploadedPhotoUrl = uploaded.webUrl;
    }
    const created = await (0, userFaceModel_1.createUserFace)({
        cpf: cpfDigits,
        descriptorJson: JSON.stringify(parsedDescriptor),
        fotoBase64: null,
        fotoUrl: uploadedPhotoUrl ?? previousFace?.FOTO_URL ?? null,
        origem: parsedOrigin || "treinamento-coletivo",
        criadoPor: parsedCreatedBy || null,
    });
    if (uploadedPhotoUrl &&
        previousFace?.FOTO_URL &&
        previousFace.FOTO_URL !== uploadedPhotoUrl) {
        await (0, sharePointService_1.deleteSharePointFileByUrl)(previousFace.FOTO_URL).catch(() => undefined);
    }
    res.status(201).json({
        face: created
            ? {
                ID: created.ID,
                USUARIO_CPF: created.USUARIO_CPF,
                USUARIO_NOME: created.USUARIO_NOME,
                FOTO_BASE64: created.FOTO_BASE64,
                FOTO_URL: created.FOTO_URL,
                ORIGEM: created.ORIGEM,
                CRIADO_POR: created.CRIADO_POR,
                CRIADO_EM: created.CRIADO_EM,
            }
            : null,
    });
});
exports.matchFace = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { descriptor, threshold } = req.body;
    const parsedDescriptor = parseDescriptor(descriptor);
    const parsedThreshold = Number(threshold);
    const matchThreshold = Number.isFinite(parsedThreshold) && parsedThreshold > 0
        ? parsedThreshold
        : DEFAULT_MATCH_THRESHOLD;
    const descriptorRows = await (0, userFaceModel_1.listFaceDescriptorsForMatch)(3);
    const candidates = descriptorRows
        .map((row) => {
        try {
            const rowDescriptor = JSON.parse(row.DESCRIPTOR_JSON);
            if (!Array.isArray(rowDescriptor) || rowDescriptor.length !== DESCRIPTOR_SIZE) {
                return null;
            }
            const numericDescriptor = rowDescriptor.map((value) => Number(value));
            if (numericDescriptor.some((value) => !Number.isFinite(value))) {
                return null;
            }
            const distance = euclideanDistance(parsedDescriptor, numericDescriptor);
            return {
                faceId: row.ID,
                cpf: row.USUARIO_CPF,
                nome: row.USUARIO_NOME,
                distance,
                createdAt: row.CRIADO_EM,
            };
        }
        catch {
            return null;
        }
    })
        .filter((item) => Boolean(item))
        .sort((left, right) => left.distance - right.distance);
    const best = candidates[0];
    const match = best && best.distance <= matchThreshold ? best : null;
    res.json({
        threshold: matchThreshold,
        match: match
            ? {
                ...match,
                confidence: Number((1 - match.distance).toFixed(6)),
            }
            : null,
        candidates: candidates.slice(0, DEFAULT_TOP_CANDIDATES).map((candidate) => ({
            ...candidate,
            confidence: Number((1 - candidate.distance).toFixed(6)),
        })),
    });
});
