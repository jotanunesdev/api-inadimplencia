"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealth = getHealth;
exports.getAllItems = getAllItems;
exports.getItem = getItem;
exports.postEstoqueMin = postEstoqueMin;
exports.putEstoqueMin = putEstoqueMin;
exports.removeEstoqueMin = removeEstoqueMin;
const env_1 = require("../config/env");
const estoqueOnlineService_1 = require("../services/estoqueOnlineService");
function buildKey(req) {
    return {
        codigoPrd: String(req.params.codigoPrd ?? '').trim(),
        codFilial: String(req.params.codFilial ?? '').trim(),
        codLoc: String(req.params.codLoc ?? '').trim(),
    };
}
function buildPayload(req) {
    return {
        estoqueMin: Number(req.body?.estoqueMin),
    };
}
async function getHealth(_req, res) {
    const snapshot = await (0, estoqueOnlineService_1.getHealthSnapshot)();
    res.status(env_1.env.isConfigured ? 200 : 503).json({
        success: true,
        data: {
            status: env_1.env.isConfigured ? 'ok' : 'degraded',
            module: 'estoque-online',
            configured: env_1.env.isConfigured,
            missingRequired: env_1.env.missingRequired,
            estoqueMinColumnAvailable: snapshot.estoqueMinColumnAvailable,
            timestamp: new Date().toISOString(),
        },
    });
}
async function getAllItems(_req, res) {
    const result = await (0, estoqueOnlineService_1.listItems)();
    res.json({
        success: true,
        data: result.items,
        meta: {
            total: result.items.length,
            excludedPrefix: '(NAO USAR)',
            estoqueMinColumnAvailable: result.estoqueMinColumnAvailable,
            generatedAt: new Date().toISOString(),
        },
    });
}
async function getItem(req, res) {
    const result = await (0, estoqueOnlineService_1.getItemByKey)(buildKey(req));
    if (!result.item) {
        res.status(404).json({
            success: false,
            error: {
                code: 'ITEM_NOT_FOUND',
                message: 'Registro nao encontrado na tabela de estoque.',
            },
        });
        return;
    }
    res.json({
        success: true,
        data: result.item,
        meta: {
            estoqueMinColumnAvailable: result.estoqueMinColumnAvailable,
        },
    });
}
async function postEstoqueMin(req, res) {
    const item = await (0, estoqueOnlineService_1.createEstoqueMin)(buildKey(req), buildPayload(req));
    res.status(201).json({
        success: true,
        data: item,
        message: 'ESTOQUEMIN criado com sucesso.',
    });
}
async function putEstoqueMin(req, res) {
    const item = await (0, estoqueOnlineService_1.updateEstoqueMin)(buildKey(req), buildPayload(req));
    res.json({
        success: true,
        data: item,
        message: 'ESTOQUEMIN atualizado com sucesso.',
    });
}
async function removeEstoqueMin(req, res) {
    const item = await (0, estoqueOnlineService_1.deleteEstoqueMin)(buildKey(req));
    res.json({
        success: true,
        data: item,
        message: 'ESTOQUEMIN removido com sucesso.',
    });
}
