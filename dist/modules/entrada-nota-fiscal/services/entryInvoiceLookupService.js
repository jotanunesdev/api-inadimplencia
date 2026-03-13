"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryInvoiceLookupService = void 0;
const errors_1 = require("../types/errors");
const Rm_1 = require("../../rm/types/Rm");
const RmEntryInvoiceLookupService_1 = require("../../rm/services/RmEntryInvoiceLookupService");
const rmLookupService = new RmEntryInvoiceLookupService_1.RmEntryInvoiceLookupService();
function normalizeLookupError(error) {
    if (error instanceof Rm_1.ValidationError) {
        throw new errors_1.AppError(400, error.message, 'ENTRY_LOOKUP_VALIDATION_ERROR');
    }
    if (error instanceof Rm_1.RmGatewayError) {
        throw new errors_1.AppError(502, error.details, 'ENTRY_LOOKUP_RM_GATEWAY_ERROR');
    }
    if (error instanceof errors_1.AppError) {
        throw error;
    }
    if (error instanceof Error) {
        throw new errors_1.AppError(500, error.message, 'ENTRY_LOOKUP_INTERNAL_ERROR');
    }
    throw new errors_1.AppError(500, 'Falha inesperada ao consultar os lookups da entrada de nota fiscal.', 'ENTRY_LOOKUP_INTERNAL_ERROR');
}
class EntryInvoiceLookupService {
    async getFiliais(query) {
        try {
            return await rmLookupService.getFiliais(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getFornecedores(query) {
        try {
            return await rmLookupService.getFornecedores(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getMovimentos(query) {
        try {
            return await rmLookupService.getMovimentos(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getParamMovimento(query) {
        try {
            return await rmLookupService.getParamMovimento(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getSeries(query) {
        try {
            return await rmLookupService.getSeries(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getLocaisEstoque(query) {
        try {
            return await rmLookupService.getLocaisEstoque(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getNaturezasFiscais(query) {
        try {
            return await rmLookupService.getNaturezasFiscais(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getCondicoesPagamento(query) {
        try {
            return await rmLookupService.getCondicoesPagamento(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getParcelamento(query) {
        try {
            return await rmLookupService.getParcelamento(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getCentrosCusto(query) {
        try {
            return await rmLookupService.getCentrosCusto(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getFormasPagamento(query) {
        try {
            return await rmLookupService.getFormasPagamento(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getPurchaseOrders(query) {
        try {
            return await rmLookupService.getPurchaseOrders(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getPurchaseOrderItems(query) {
        try {
            return await rmLookupService.getPurchaseOrderItems(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
    async getPurchaseOrderApportionments(query) {
        try {
            return await rmLookupService.getPurchaseOrderApportionments(query);
        }
        catch (error) {
            normalizeLookupError(error);
        }
    }
}
exports.EntryInvoiceLookupService = EntryInvoiceLookupService;
