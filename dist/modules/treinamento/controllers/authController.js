"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePassword = exports.firstAccess = exports.login = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const httpError_1 = require("../utils/httpError");
const normalizeCpf_1 = require("../utils/normalizeCpf");
const password_1 = require("../utils/password");
const readViewService_1 = require("../services/readViewService");
const userModel_1 = require("../models/userModel");
const userMapping_1 = require("../utils/userMapping");
function sanitizeUser(user) {
    if (!user)
        return null;
    const { HASH_SENHA: _hashSenha, READVIEW_JSON: _readView, ...safe } = user;
    return safe;
}
exports.login = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf, password } = req.body;
    if (!cpf) {
        throw new httpError_1.HttpError(400, "CPF e obrigatorio");
    }
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf);
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    const filter = `PPESSOA.CPF='${cpfDigits}' AND PFUNC.CODSITUACAO='A'`;
    const readViewResult = await (0, readViewService_1.readView)({
        dataServerName: "FopFuncData",
        filter,
        context: "CODCOLIGADA=1",
    });
    const pfunc = (0, readViewService_1.extractPFunc)(readViewResult);
    if (!pfunc) {
        throw new httpError_1.HttpError(404, "Usuario nao encontrado no ReadView");
    }
    const mapped = (0, userMapping_1.mapReadViewToUser)({ ...pfunc, CPF: cpfDigits });
    const user = await (0, userModel_1.upsertUser)(mapped);
    const safeUser = sanitizeUser(user);
    if (!user?.HASH_SENHA) {
        res.status(409).json({
            error: "PRIMEIRO_ACESSO",
            message: "Senha nao cadastrada. Use o endpoint de primeiro acesso.",
            user: safeUser,
        });
        return;
    }
    if (!password) {
        throw new httpError_1.HttpError(400, "Senha e obrigatoria");
    }
    const valid = await (0, password_1.comparePassword)(password, user.HASH_SENHA);
    if (!valid) {
        throw new httpError_1.HttpError(401, "Senha invalida");
    }
    res.json({ user: safeUser });
});
exports.firstAccess = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf, dtNascimento, password } = req.body;
    if (!cpf || !dtNascimento || !password) {
        throw new httpError_1.HttpError(400, "CPF, data de nascimento e senha sao obrigatorios");
    }
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf);
    if (cpfDigits.length !== 11) {
        throw new httpError_1.HttpError(400, "CPF invalido");
    }
    const filter = `PPESSOA.DTNASCIMENTO='${dtNascimento} 00:00:00.000' AND PPESSOA.CPF='${cpfDigits}' AND PFUNC.CODSITUACAO='A'`;
    const readViewResult = await (0, readViewService_1.readView)({
        dataServerName: "FopFuncData",
        filter,
        context: "CODCOLIGADA=1",
    });
    const pfunc = (0, readViewService_1.extractPFunc)(readViewResult);
    if (!pfunc) {
        throw new httpError_1.HttpError(404, "Usuario nao encontrado no ReadView");
    }
    const passwordHash = await (0, password_1.hashPassword)(password);
    const mapped = (0, userMapping_1.mapReadViewToUser)({ ...pfunc, CPF: cpfDigits });
    const user = await (0, userModel_1.upsertUser)({ ...mapped, hashSenha: passwordHash });
    res.status(201).json({ user: sanitizeUser(user) });
});
exports.updatePassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { cpf } = req.params;
    const { currentPassword, newPassword } = req.body;
    if (!cpf || !currentPassword || !newPassword) {
        throw new httpError_1.HttpError(400, "CPF, senha atual e nova senha sao obrigatorios");
    }
    const cpfDigits = (0, normalizeCpf_1.normalizeCpf)(cpf);
    const user = await (0, userModel_1.getUserByCpf)(cpfDigits);
    if (!user?.HASH_SENHA) {
        throw new httpError_1.HttpError(404, "Usuario nao encontrado ou sem senha cadastrada");
    }
    const valid = await (0, password_1.comparePassword)(currentPassword, user.HASH_SENHA);
    if (!valid) {
        throw new httpError_1.HttpError(401, "Senha atual invalida");
    }
    const hash = await (0, password_1.hashPassword)(newPassword);
    const updated = await (0, userModel_1.updateUserPassword)(cpfDigits, hash);
    res.json({ user: sanitizeUser(updated) });
});
