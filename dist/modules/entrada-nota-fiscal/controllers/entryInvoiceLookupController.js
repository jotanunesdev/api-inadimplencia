"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryInvoiceLookupController = void 0;
function normalizeQuery(query) {
    return Object.entries(query).reduce((accumulator, [key, value]) => {
        if (typeof value === 'string') {
            accumulator[key] = value;
        }
        return accumulator;
    }, {});
}
class EntryInvoiceLookupController {
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
            next(error);
        }
    };
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
    taxRates = this.respond((query) => this.service.getTaxRates(query));
    purchaseOrders = this.respond((query) => this.service.getPurchaseOrders(query));
    purchaseOrderItems = this.respond((query) => this.service.getPurchaseOrderItems(query));
    purchaseOrderApportionments = this.respond((query) => this.service.getPurchaseOrderApportionments(query));
}
exports.EntryInvoiceLookupController = EntryInvoiceLookupController;
