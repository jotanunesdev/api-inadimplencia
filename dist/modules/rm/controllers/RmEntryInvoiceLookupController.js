"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RmEntryInvoiceLookupController = void 0;
const Rm_1 = require("../types/Rm");
function normalizeQuery(query) {
    return Object.entries(query).reduce((accumulator, [key, value]) => {
        if (typeof value === 'string') {
            accumulator[key] = value;
            return accumulator;
        }
        if (Array.isArray(value) && typeof value[0] === 'string') {
            accumulator[key] = value[0];
        }
        return accumulator;
    }, {});
}
class RmEntryInvoiceLookupController {
    service;
    constructor(service) {
        this.service = service;
    }
    respond = (fn) => async (req, res, next) => {
        try {
            const data = await fn(normalizeQuery(req.query));
            res.status(200).json({
                success: true,
                data,
            });
        }
        catch (error) {
            if (error instanceof Rm_1.ValidationError) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'RM_LOOKUP_VALIDATION_ERROR',
                        message: error.message,
                    },
                });
                return;
            }
            if (error instanceof Rm_1.RmGatewayError) {
                res.status(502).json({
                    success: false,
                    error: {
                        code: 'RM_LOOKUP_GATEWAY_ERROR',
                        message: error.details,
                    },
                });
                return;
            }
            next(error);
        }
    };
    coligadas = this.respond((query) => this.service.getColigadas(query));
    filiais = this.respond((query) => this.service.getFiliais(query));
    fornecedores = this.respond((query) => this.service.getFornecedores(query));
    movimentos = this.respond((query) => this.service.getMovimentos(query));
    paramMovimento = this.respond((query) => this.service.getParamMovimento(query));
    series = this.respond((query) => this.service.getSeries(query));
    locaisEstoque = this.respond((query) => this.service.getLocaisEstoque(query));
    naturezasFiscais = this.respond((query) => this.service.getNaturezasFiscais(query));
    condicoesPagamento = this.respond((query) => this.service.getCondicoesPagamento(query));
    parcelamento = this.respond((query) => this.service.getParcelamento(query));
    estados = this.respond((query) => this.service.getEstados(query));
    municipios = this.respond((query) => this.service.getMunicipios(query));
    centrosCusto = this.respond((query) => this.service.getCentrosCusto(query));
    formasPagamento = this.respond((query) => this.service.getFormasPagamento(query));
    formasPagamentoResumo = this.respond((query) => this.service.getFormasPagamentoResumo(query));
    contasCaixa = this.respond((query) => this.service.getContasCaixa(query));
    purchaseOrders = this.respond((query) => this.service.getPurchaseOrders(query));
    purchaseOrderItems = this.respond((query) => this.service.getPurchaseOrderItems(query));
    purchaseOrderApportionments = this.respond((query) => this.service.getPurchaseOrderApportionments(query));
    purchaseOrderApportionmentByItem = this.respond((query) => this.service.getPurchaseOrderApportionmentByItem(query));
    taxes = this.respond((query) => this.service.getTaxes(query));
    taxRates = this.respond((query) => this.service.getTaxRates(query));
    lancamentosFinanceiros = this.respond((query) => this.service.getLancamentosFinanceiros(query));
    detalhesTipoPagamento = this.respond((query) => this.service.getDetalhesTipoPagamento(query));
}
exports.RmEntryInvoiceLookupController = RmEntryInvoiceLookupController;
