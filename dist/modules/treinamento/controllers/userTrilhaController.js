"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.listByCpf = exports.assign = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const userModel_1 = require("../models/userModel");
const userTrilhaModel_1 = require("../models/userTrilhaModel");
const userMapping_1 = require("../utils/userMapping");
const provaModel_1 = require("../models/provaModel");
const trilhaModel_1 = require("../models/trilhaModel");
exports.assign = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf, trilhaIds, atribuidoPor, user } = req.body;
    if (!cpf || !Array.isArray(trilhaIds) || trilhaIds.length === 0) {
        throw new httpError_1.HttpError(400, "cpf e trilhaIds sao obrigatorios");
    }
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf);
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    for (const trilhaId of trilhaIds) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const hasProva = await (0, provaModel_1.trilhaHasObjectiveProva)(trilhaId);
            if (!hasProva) {
                throw new httpError_1.HttpError(400, "Toda trilha deve possuir prova objetiva antes de ser atribuida.");
            }
            // eslint-disable-next-line no-await-in-loop
            const hasEficacia = await (0, trilhaModel_1.trilhaHasEficaciaConfig)(trilhaId);
            if (!hasEficacia) {
                throw new httpError_1.HttpError(400, "Toda trilha deve possuir avaliacao de eficacia configurada antes de ser atribuida.");
            }
        }
        catch (error) {
            const code = error && typeof error === "object" && "code" in error
                ? String(error.code ?? "")
                : "";
            if (code === "TRILHA_EFICACIA_CONFIG_COLUMNS_MISSING") {
                throw new httpError_1.HttpError(400, "Banco sem suporte a configuracao de avaliacao de eficacia por trilha. Execute a migration de TTRILHAS.");
            }
            if (error instanceof httpError_1.HttpError)
                throw error;
            throw error;
        }
    }
    if (user && typeof user === "object") {
        const mapped = (0, userMapping_1.mapReadViewToUser)({ ...user, CPF: cpfDigits });
        await (0, userModel_1.upsertUser)(mapped);
    }
    else {
        const existing = await (0, userModel_1.getUserByCpf)(cpfDigits);
        if (!existing) {
            await (0, userModel_1.upsertUser)({ cpf: cpfDigits });
        }
    }
    const result = await (0, userTrilhaModel_1.assignTrilhas)(cpfDigits, trilhaIds, atribuidoPor ?? null);
    res.status(201).json(result);
});
exports.listByCpf = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(req.params.cpf);
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    const { moduloId } = req.query;
    const trilhas = await (0, userTrilhaModel_1.listUserTrilhas)(cpfDigits, moduloId);
    res.json({ trilhas });
});
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(req.params.cpf);
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    const removed = await (0, userTrilhaModel_1.removeUserTrilha)(cpfDigits, req.params.trilhaId);
    if (!removed) {
        throw new httpError_1.HttpError(404, "Vinculo nao encontrado");
    }
    res.status(204).send();
});
