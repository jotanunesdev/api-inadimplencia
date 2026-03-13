"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RmEntryInvoiceLookupService = void 0;
const Rm_1 = require("../types/Rm");
const entryInvoiceLookupDefinitions_1 = require("./entryInvoiceLookupDefinitions");
const { buildConstraint, fetchDataset } = require('../../../shared/fluigDataset.js');
const DATASET_NAME = 'dsIntegraFacilRM';
const DATASET_ENV_PREFIX = 'RM_FLUIG';
function toLookupRows(dataset) {
    const values = dataset.values ??
        dataset.content ??
        [];
    if (!Array.isArray(values)) {
        return [];
    }
    return values;
}
function readDatasetError(rows) {
    const firstRow = rows[0];
    if (!firstRow) {
        return null;
    }
    const error = firstRow.ERRO ?? firstRow.erro;
    return error ? String(error) : null;
}
function sanitizeParameterValue(key, value) {
    if (key === 'LIMITEFLUIG') {
        return value && value.trim() ? value.trim() : entryInvoiceLookupDefinitions_1.DEFAULT_LIMIT;
    }
    if (key === 'BUSCADOR') {
        return value && value.trim() ? value.trim() : entryInvoiceLookupDefinitions_1.DEFAULT_SEARCH;
    }
    if (key === 'SEPARADOR') {
        return value && value.trim() ? value.trim() : entryInvoiceLookupDefinitions_1.DEFAULT_SEPARATOR;
    }
    if (key === 'SEPARADORLIST') {
        return value && value.trim() ? value.trim() : '_';
    }
    return String(value ?? '').trim();
}
function buildParameterString(definition, query) {
    return definition.parameterKeys
        .map((key) => `${key}=${sanitizeParameterValue(key, query[key])}`)
        .join('|');
}
function splitList(value) {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
class RmEntryInvoiceLookupService {
    async executeLookup(definition, query) {
        try {
            const dataset = await fetchDataset(DATASET_NAME, {
                envPrefix: DATASET_ENV_PREFIX,
                constraints: [
                    buildConstraint('SENTENCA', definition.code),
                    buildConstraint('COLIGADA', '0'),
                    buildConstraint('PARAMETER', buildParameterString(definition, query)),
                    buildConstraint('APLICACAO', 'G'),
                    buildConstraint('OBJETO', 'Resultado'),
                    buildConstraint('OPC', '4'),
                    buildConstraint('CAMPOS', definition.fields),
                ],
            });
            const rows = toLookupRows(dataset);
            const error = readDatasetError(rows);
            if (error) {
                throw new Rm_1.RmGatewayError(error);
            }
            return rows;
        }
        catch (error) {
            if (error instanceof Rm_1.ValidationError || error instanceof Rm_1.RmGatewayError) {
                throw error;
            }
            if (error instanceof Error) {
                throw new Rm_1.RmGatewayError(error.message);
            }
            throw new Rm_1.RmGatewayError('Falha inesperada ao consultar lookup da entrada de nota fiscal.');
        }
    }
    getColigadas(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.coligada, query);
    }
    getFiliais(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.filial, query);
    }
    getFornecedores(query) {
        const definition = query.BASECNPJ
            ? entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.fornecedorBaseCnpj
            : entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.fornecedor;
        return this.executeLookup(definition, query);
    }
    getMovimentos(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.movimento, query);
    }
    async getParamMovimento(query) {
        const rows = await this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.paramMovimento, query);
        return rows[0] ?? null;
    }
    getSeries(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.serie, query);
    }
    getLocaisEstoque(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.localEstoque, query);
    }
    getNaturezasFiscais(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.naturezaFiscal, query);
    }
    getCondicoesPagamento(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.condicaoPagto, query);
    }
    getParcelamento(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.parcelamento, query);
    }
    getEstados(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.estado, query);
    }
    getMunicipios(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.municipio, query);
    }
    getCentrosCusto(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.centroCusto, query);
    }
    getFormasPagamento(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.formaPagto, query);
    }
    getFormasPagamentoResumo(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.formaPagtoResumo, query);
    }
    getContasCaixa(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.codCxa, query);
    }
    getPurchaseOrders(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.purchaseOrder, query);
    }
    getPurchaseOrderItems(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.purchaseOrderItems, query);
    }
    async getPurchaseOrderApportionments(query) {
        const codColigada = String(query.CODCOLIGADA ?? '').trim();
        const ids = splitList(query.LISTIDMOV);
        if (!codColigada) {
            throw new Rm_1.ValidationError('Parametro "CODCOLIGADA" e obrigatorio');
        }
        if (ids.length === 0) {
            return [];
        }
        const rows = await Promise.all(ids.map((idMov) => this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.purchaseOrderApport, {
            CODCOLIGADA: codColigada,
            IDMOV: idMov,
        })));
        return rows.flat();
    }
    getPurchaseOrderApportionmentByItem(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.purchaseOrderApportEspecific, query);
    }
    getTaxes(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.taxes, query);
    }
    getTaxRates(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.taxesAliquotas, query);
    }
    getLancamentosFinanceiros(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.lancamentosFinanceiros, query);
    }
    getDetalhesTipoPagamento(query) {
        return this.executeLookup(entryInvoiceLookupDefinitions_1.ENTRY_INVOICE_LOOKUPS.detalhesTipoPagamento, query);
    }
}
exports.RmEntryInvoiceLookupService = RmEntryInvoiceLookupService;
