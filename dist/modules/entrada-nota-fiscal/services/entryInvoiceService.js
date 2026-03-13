"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryInvoiceService = void 0;
const crypto_1 = require("crypto");
const env_1 = require("../config/env");
const db_1 = require("../config/db");
const errors_1 = require("../types/errors");
const normalize_1 = require("../utils/normalize");
const schemaService_1 = require("./schemaService");
const entryInvoiceValidationService_1 = require("./entryInvoiceValidationService");
const RmEntryInvoiceMovementService_1 = require("../../rm/services/RmEntryInvoiceMovementService");
const RmEntryInvoiceLookupService_1 = require("../../rm/services/RmEntryInvoiceLookupService");
function quoteIdentifier(identifier) {
    return `[${identifier}]`;
}
function tableName(suffix) {
    return `${quoteIdentifier(env_1.env.DB_SCHEMA)}.${quoteIdentifier(`${env_1.env.TABLE_PREFIX}_${suffix}`)}`;
}
function normalizeLineNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function normalizeMode(value) {
    const normalized = String(value ?? '').toLowerCase();
    return normalized === 'submit' ||
        normalized === 'submitted' ||
        normalized === 'pending_analysis' ||
        normalized === 'approved' ||
        normalized === 'rejected'
        ? 'submit'
        : 'draft';
}
function normalizeStatus(mode) {
    return mode === 'submit' ? 'pending_analysis' : 'draft';
}
function normalizePersistedStatus(value) {
    const normalized = String(value ?? '').toLowerCase();
    if (normalized === 'submitted') {
        return 'pending_analysis';
    }
    if (normalized === 'draft' ||
        normalized === 'pending_analysis' ||
        normalized === 'approved' ||
        normalized === 'rejected') {
        return normalized;
    }
    return 'draft';
}
function mapDateValue(value) {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
}
function mapDateTimeValue(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return new Date(String(value)).toISOString();
}
function parsePayloadJson(row) {
    const rawPayload = row.payload_json;
    if (!rawPayload || typeof rawPayload !== 'string') {
        return {};
    }
    try {
        return JSON.parse(rawPayload);
    }
    catch {
        return {};
    }
}
function mapHeader(input) {
    return {
        filialDescription: (0, normalize_1.toNullableString)(input?.filialDescription),
        codColigada: (0, normalize_1.toNullableString)(input?.codColigada),
        codFilial: (0, normalize_1.toNullableString)(input?.codFilial),
        codUfOper: (0, normalize_1.toNullableString)(input?.codUfOper),
        descUfOper: (0, normalize_1.toNullableString)(input?.descUfOper),
        codMunOper: (0, normalize_1.toNullableString)(input?.codMunOper),
        descMunOper: (0, normalize_1.toNullableString)(input?.descMunOper),
        idOperacao: (0, normalize_1.toNullableString)(input?.idOperacao),
        numeroMov: (0, normalize_1.toNullableString)(input?.numeroMov),
        fornecedorDescription: (0, normalize_1.toNullableString)(input?.fornecedorDescription),
        codCfo: (0, normalize_1.toNullableString)(input?.codCfo),
        codColCfo: (0, normalize_1.toNullableString)(input?.codColCfo),
        cnpjCpf: (0, normalize_1.toNullableString)(input?.cnpjCpf),
        dataEmissao: (0, normalize_1.toDateOnly)(input?.dataEmissao),
        dataSaida: (0, normalize_1.toDateOnly)(input?.dataSaida),
        localEstoqueDescription: (0, normalize_1.toNullableString)(input?.localEstoqueDescription),
        codLoc: (0, normalize_1.toNullableString)(input?.codLoc),
        movimentoDescription: (0, normalize_1.toNullableString)(input?.movimentoDescription),
        codTmv: (0, normalize_1.toNullableString)(input?.codTmv),
        codTdo: (0, normalize_1.toNullableString)(input?.codTdo),
        serie: (0, normalize_1.toNullableString)(input?.serie),
        idNat: (0, normalize_1.toNullableString)(input?.idNat),
        codNat: (0, normalize_1.toNullableString)(input?.codNat),
        naturezaDescription: (0, normalize_1.toNullableString)(input?.naturezaDescription),
        qualidade: (0, normalize_1.toNullableNumber)(input?.qualidade),
        prazo: (0, normalize_1.toNullableNumber)(input?.prazo),
        atendimento: (0, normalize_1.toNullableNumber)(input?.atendimento),
        valorBruto: (0, normalize_1.toNullableNumber)(input?.valorBruto),
        valorLiquido: (0, normalize_1.toNullableNumber)(input?.valorLiquido),
        valorFrete: (0, normalize_1.toNullableNumber)(input?.valorFrete),
        valorDesc: (0, normalize_1.toNullableNumber)(input?.valorDesc),
        valorDesp: (0, normalize_1.toNullableNumber)(input?.valorDesp),
        valorOutros: (0, normalize_1.toNullableNumber)(input?.valorOutros),
        chaveAcessoNfe: (0, normalize_1.toNullableString)(input?.chaveAcessoNfe),
        gerarFrap: (0, normalize_1.toBoolean)(input?.gerarFrap),
        dataPrevBaixa: (0, normalize_1.toDateOnly)(input?.dataPrevBaixa),
        historico: (0, normalize_1.toNullableString)(input?.historico),
        observacaoAvaliacao: (0, normalize_1.toNullableString)(input?.observacaoAvaliacao),
        financeiro: (0, normalize_1.toBoolean)(input?.financeiro),
        possuiAdiantamento: (0, normalize_1.toBoolean)(input?.possuiAdiantamento),
        codCpg: (0, normalize_1.toNullableString)(input?.codCpg),
        descricaoCodCpg: (0, normalize_1.toNullableString)(input?.descricaoCodCpg),
        codCxa: (0, normalize_1.toNullableString)(input?.codCxa),
        descricaoCodCxa: (0, normalize_1.toNullableString)(input?.descricaoCodCxa),
    };
}
function mapPurchaseOrders(items) {
    return (items ?? []).map((item, index) => ({
        lineNumber: normalizeLineNumber(item?.lineNumber, index + 1),
        seqF: (0, normalize_1.toNullableString)(item?.seqF),
        idMov: (0, normalize_1.toNullableString)(item?.idMov),
        numeroMov: (0, normalize_1.toNullableString)(item?.numeroMov),
        codTmvOc: (0, normalize_1.toNullableString)(item?.codTmvOc),
        tipoMovimento: (0, normalize_1.toNullableString)(item?.tipoMovimento),
        dataEmissao: (0, normalize_1.toDateOnly)(item?.dataEmissao),
        valor: (0, normalize_1.toNullableNumber)(item?.valor),
        cgcCfo: (0, normalize_1.toNullableString)(item?.cgcCfo),
        fornecedorNome: (0, normalize_1.toNullableString)(item?.fornecedorNome),
        movimentoDestinoCodigo: (0, normalize_1.toNullableString)(item?.movimentoDestinoCodigo),
        movimentoDestinoDescricao: (0, normalize_1.toNullableString)(item?.movimentoDestinoDescricao),
    }));
}
function mapItems(items, header) {
    const fallbackIdNat = (0, normalize_1.toNullableString)(header?.idNat);
    const fallbackCodNat = (0, normalize_1.toNullableString)(header?.codNat);
    const fallbackDescNat = (0, normalize_1.toNullableString)(header?.naturezaDescription);
    return (items ?? []).map((item, index) => ({
        lineNumber: normalizeLineNumber(item?.lineNumber, index + 1),
        seqF: (0, normalize_1.toNullableString)(item?.seqF),
        nomeFantasia: (0, normalize_1.toNullableString)(item?.nomeFantasia),
        codigoPrd: (0, normalize_1.toNullableString)(item?.codigoPrd),
        idPrd: (0, normalize_1.toNullableString)(item?.idPrd),
        numNoFabric: (0, normalize_1.toNullableString)(item?.numNoFabric),
        tipo: (0, normalize_1.toNullableString)(item?.tipo),
        codUnd: (0, normalize_1.toNullableString)(item?.codUnd),
        nseqItmMov: (0, normalize_1.toNullableString)(item?.nseqItmMov),
        idNat: (0, normalize_1.toNullableString)(item?.idNat) ?? fallbackIdNat,
        codNat: (0, normalize_1.toNullableString)(item?.codNat) ?? fallbackCodNat,
        descNat: (0, normalize_1.toNullableString)(item?.descNat) ?? fallbackDescNat,
        codColTborcamento: (0, normalize_1.toNullableString)(item?.codColTborcamento),
        codTborcamento: (0, normalize_1.toNullableString)(item?.codTborcamento),
        descTborcamento: (0, normalize_1.toNullableString)(item?.descTborcamento) ?? (0, normalize_1.toNullableString)(item?.codTborcamento),
        idMovOc: (0, normalize_1.toNullableString)(item?.idMovOc),
        nseqItmMovOc: (0, normalize_1.toNullableString)(item?.nseqItmMovOc),
        quantidade: (0, normalize_1.toNullableNumber)(item?.quantidade),
        precoUnitario: (0, normalize_1.toNullableNumber)(item?.precoUnitario),
        valorBrutoItem: (0, normalize_1.toNullableNumber)(item?.valorBrutoItem),
        valorTotalItem: (0, normalize_1.toNullableNumber)(item?.valorTotalItem),
        valorLiquido: (0, normalize_1.toNullableNumber)(item?.valorLiquido),
    }));
}
function mapApportionments(items) {
    return (items ?? []).map((item, index) => ({
        lineNumber: normalizeLineNumber(item?.lineNumber, index + 1),
        seqF: (0, normalize_1.toNullableString)(item?.seqF),
        itemSeqF: (0, normalize_1.toNullableString)(item?.itemSeqF),
        nseqItmMov: (0, normalize_1.toNullableString)(item?.nseqItmMov),
        descCusto: (0, normalize_1.toNullableString)(item?.descCusto),
        codCcusto: (0, normalize_1.toNullableString)(item?.codCcusto),
        valor: (0, normalize_1.toNullableNumber)(item?.valor),
    }));
}
function mapTaxes(items) {
    return (items ?? []).map((item, index) => ({
        lineNumber: normalizeLineNumber(item?.lineNumber, index + 1),
        seqF: (0, normalize_1.toNullableString)(item?.seqF),
        itemSeqF: (0, normalize_1.toNullableString)(item?.itemSeqF),
        nseqItmMov: (0, normalize_1.toNullableString)(item?.nseqItmMov),
        codTrb: (0, normalize_1.toNullableString)(item?.codTrb),
        sitTributaria: (0, normalize_1.toNullableString)(item?.sitTributaria),
        baseDeCalculo: (0, normalize_1.toNullableNumber)(item?.baseDeCalculo),
        aliquota: (0, normalize_1.toNullableNumber)(item?.aliquota),
        tipoRecolhimento: (0, normalize_1.toNullableString)(item?.tipoRecolhimento) ?? '1',
        valor: (0, normalize_1.toNullableNumber)(item?.valor),
    }));
}
function mapPayments(items) {
    return (items ?? []).map((item, index) => ({
        lineNumber: normalizeLineNumber(item?.lineNumber, index + 1),
        seqF: (0, normalize_1.toNullableString)(item?.seqF),
        codColigada: (0, normalize_1.toNullableString)(item?.codColigada),
        idMov: (0, normalize_1.toNullableString)(item?.idMov),
        idSeqPagto: (0, normalize_1.toNullableString)(item?.idSeqPagto),
        dataVencimento: (0, normalize_1.toDateOnly)(item?.dataVencimento),
        valor: (0, normalize_1.toNullableNumber)(item?.valor),
        descFormaPagto: (0, normalize_1.toNullableString)(item?.descFormaPagto),
        idFormaPagto: (0, normalize_1.toNullableString)(item?.idFormaPagto),
        tipoFormaPagto: (0, normalize_1.toNullableString)(item?.tipoFormaPagto),
        codColCxa: (0, normalize_1.toNullableString)(item?.codColCxa),
        descCodCxa: (0, normalize_1.toNullableString)(item?.descCodCxa),
        codCxa: (0, normalize_1.toNullableString)(item?.codCxa),
        tipoPagamento: (0, normalize_1.toNullableString)(item?.tipoPagamento) ?? '1',
        debitoCredito: (0, normalize_1.toNullableString)(item?.debitoCredito) ?? 'C',
        taxaAdm: (0, normalize_1.toNullableNumber)(item?.taxaAdm),
        idLan: (0, normalize_1.toNullableString)(item?.idLan),
        adtIntegrado: (0, normalize_1.toNullableString)(item?.adtIntegrado) ?? 'nao',
        linhaDigitavel: (0, normalize_1.toNullableString)(item?.linhaDigitavel),
    }));
}
function mapRecordFromInput(id, payload, createdAt, updatedAt, createdBy) {
    const mode = normalizeMode(payload.mode);
    const requestedBy = (0, normalize_1.toNullableString)(payload.requestedBy);
    const normalizedHeader = mapHeader(payload.header);
    return normalizeItemSequences({
        id,
        status: normalizeStatus(mode),
        mode,
        requestedBy,
        createdBy: createdBy ?? requestedBy,
        updatedBy: requestedBy,
        reviewComment: null,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rmMovementId: null,
        rmPrimaryKey: null,
        rmIntegrationStatus: null,
        rmIntegrationMessage: null,
        createdAt,
        updatedAt,
        header: normalizedHeader,
        purchaseOrders: mapPurchaseOrders(payload.purchaseOrders),
        items: mapItems(payload.items, normalizedHeader),
        apportionments: mapApportionments(payload.apportionments),
        taxes: mapTaxes(payload.taxes),
        payments: mapPayments(payload.payments),
    });
}
function normalizeItemSequences(record) {
    const nextItems = record.items.map((item, index) => ({
        ...item,
        nseqItmMov: String(index + 1),
    }));
    const nseqBySeqF = new Map(nextItems
        .filter((item) => item.seqF)
        .map((item) => [String(item.seqF), String(item.nseqItmMov ?? item.lineNumber)]));
    const nextApportionments = record.apportionments.map((apportionment) => ({
        ...apportionment,
        nseqItmMov: (apportionment.itemSeqF ? nseqBySeqF.get(String(apportionment.itemSeqF)) : null) ??
            (0, normalize_1.toNullableString)(apportionment.nseqItmMov) ??
            null,
    }));
    const nextTaxes = record.taxes.map((tax) => ({
        ...tax,
        nseqItmMov: (tax.itemSeqF ? nseqBySeqF.get(String(tax.itemSeqF)) : null) ??
            (0, normalize_1.toNullableString)(tax.nseqItmMov) ??
            null,
    }));
    return {
        ...record,
        items: nextItems,
        apportionments: nextApportionments,
        taxes: nextTaxes,
    };
}
class EntryInvoiceService {
    rmEntryInvoiceMovementService = new RmEntryInvoiceMovementService_1.RmEntryInvoiceMovementService();
    rmEntryInvoiceLookupService = new RmEntryInvoiceLookupService_1.RmEntryInvoiceLookupService();
    getFormMetadata() {
        return {
            ratings: [1, 2, 3, 4, 5].map((value) => ({
                value,
                label: `${value} estrela${value > 1 ? 's' : ''}`,
            })),
            statuses: [
                { value: 'draft', label: 'Rascunho' },
                { value: 'pending_analysis', label: 'Pendente de Analise' },
                { value: 'approved', label: 'Aprovada' },
                { value: 'rejected', label: 'Reprovada' },
            ],
            saveModes: [
                { value: 'draft', label: 'Salvar rascunho' },
                { value: 'submit', label: 'Salvar e submeter' },
            ],
            defaults: {
                codColigada: '1',
                coligadaDescription: 'JOTANUNES CONSTRUTORA LTDA',
            },
            sections: [
                { key: 'header', label: 'Cabecalho', description: 'Dados principais da nota fiscal e do fornecedor.' },
                { key: 'purchaseOrders', label: 'Ordens de Compra', description: 'Ordens vinculadas a entrada da nota fiscal.' },
                { key: 'items', label: 'Itens', description: 'Itens recebidos na nota fiscal.' },
                { key: 'apportionments', label: 'Rateios', description: 'Rateio por centro de custo vinculado aos itens.' },
                { key: 'taxes', label: 'Tributos', description: 'Tributos por item, com base de calculo, aliquota e recolhimento.' },
                { key: 'payments', label: 'Pagamentos', description: 'Parcelas financeiras previstas para a nota.' },
            ],
        };
    }
    async listEntries(query) {
        await (0, schemaService_1.ensureDatabaseStructure)();
        const pool = await (0, db_1.getPool)();
        const request = pool.request();
        const search = (0, normalize_1.toNullableString)(query.search);
        const status = query.status && query.status !== 'all' ? query.status : null;
        const offset = (query.page - 1) * query.pageSize;
        const entriesTable = tableName('entries');
        request.input('search', search);
        request.input('status', status);
        request.input('offset', offset);
        request.input('pageSize', query.pageSize);
        const filterClause = `
      WHERE deleted_at IS NULL
        AND (
          @status IS NULL
          OR (@status = 'pending_analysis' AND status IN ('pending_analysis', 'submitted'))
          OR status = @status
        )
        AND (
          @search IS NULL
          OR numero_mov LIKE '%' + @search + '%'
          OR serie LIKE '%' + @search + '%'
          OR fornecedor_description LIKE '%' + @search + '%'
          OR filial_description LIKE '%' + @search + '%'
        )
    `;
        const result = await request.query(`
      SELECT
        id,
        status,
        numero_mov,
        serie,
        fornecedor_description,
        filial_description,
        data_emissao,
        valor_liquido,
        payload_json,
        created_by,
        rm_movement_id,
        review_comment,
        updated_at
      FROM ${entriesTable}
      ${filterClause}
      ORDER BY updated_at DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

      SELECT COUNT(1) AS total
      FROM ${entriesTable}
      ${filterClause};
    `);
        const recordsets = result.recordsets;
        const items = (recordsets[0] ?? []).map((row) => ({
            id: String(row.id),
            status: normalizePersistedStatus(row.status),
            numeroMov: (0, normalize_1.toNullableString)(row.numero_mov),
            serie: (0, normalize_1.toNullableString)(row.serie),
            fornecedorDescription: (0, normalize_1.toNullableString)(row.fornecedor_description),
            filialDescription: (0, normalize_1.toNullableString)(row.filial_description),
            dataEmissao: mapDateValue(row.data_emissao),
            valorLiquido: (0, normalize_1.toNullableNumber)(row.valor_liquido),
            requestedBy: (0, normalize_1.toNullableString)(parsePayloadJson(row).requestedBy) ?? (0, normalize_1.toNullableString)(row.created_by),
            rmMovementId: (0, normalize_1.toNullableString)(row.rm_movement_id),
            reviewComment: (0, normalize_1.toNullableString)(row.review_comment),
            updatedAt: mapDateTimeValue(row.updated_at),
        }));
        const total = Number(recordsets[1]?.[0]?.total ?? 0);
        return {
            items,
            page: query.page,
            pageSize: query.pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        };
    }
    async getEntryById(entryId) {
        await (0, schemaService_1.ensureDatabaseStructure)();
        const pool = await (0, db_1.getPool)();
        const request = pool.request();
        const entriesTable = tableName('entries');
        const purchaseOrdersTable = tableName('purchase_orders');
        const itemsTable = tableName('items');
        const apportionmentsTable = tableName('apportionments');
        const taxesTable = tableName('taxes');
        const paymentsTable = tableName('payments');
        request.input('entryId', entryId);
        const result = await request.query(`
      SELECT TOP 1 *
      FROM ${entriesTable}
      WHERE id = @entryId
        AND deleted_at IS NULL;

      SELECT * FROM ${purchaseOrdersTable} WHERE entry_id = @entryId ORDER BY line_number ASC;
      SELECT * FROM ${itemsTable} WHERE entry_id = @entryId ORDER BY line_number ASC;
      SELECT * FROM ${apportionmentsTable} WHERE entry_id = @entryId ORDER BY line_number ASC;
      SELECT * FROM ${taxesTable} WHERE entry_id = @entryId ORDER BY line_number ASC;
      SELECT * FROM ${paymentsTable} WHERE entry_id = @entryId ORDER BY line_number ASC;
    `);
        const recordsets = result.recordsets;
        const headerRow = recordsets[0]?.[0];
        if (!headerRow) {
            throw new errors_1.AppError(404, 'Registro de Entrada de Nota Fiscal nao encontrado.', 'ENTRY_NOT_FOUND');
        }
        const payload = parsePayloadJson(headerRow);
        const mode = normalizeMode(payload.mode ?? headerRow.status);
        const entryRecord = {
            id: String(headerRow.id),
            status: normalizePersistedStatus(headerRow.status),
            mode,
            requestedBy: (0, normalize_1.toNullableString)(payload.requestedBy),
            createdBy: (0, normalize_1.toNullableString)(headerRow.created_by),
            updatedBy: (0, normalize_1.toNullableString)(headerRow.updated_by),
            reviewComment: (0, normalize_1.toNullableString)(headerRow.review_comment),
            approvedBy: (0, normalize_1.toNullableString)(headerRow.approved_by),
            approvedAt: headerRow.approved_at ? mapDateTimeValue(headerRow.approved_at) : null,
            rejectedBy: (0, normalize_1.toNullableString)(headerRow.rejected_by),
            rejectedAt: headerRow.rejected_at ? mapDateTimeValue(headerRow.rejected_at) : null,
            rmMovementId: (0, normalize_1.toNullableString)(headerRow.rm_movement_id),
            rmPrimaryKey: (0, normalize_1.toNullableString)(headerRow.rm_primary_key),
            rmIntegrationStatus: (0, normalize_1.toNullableString)(headerRow.rm_integration_status),
            rmIntegrationMessage: (0, normalize_1.toNullableString)(headerRow.rm_integration_message),
            createdAt: mapDateTimeValue(headerRow.created_at),
            updatedAt: mapDateTimeValue(headerRow.updated_at),
            header: {
                filialDescription: (0, normalize_1.toNullableString)(headerRow.filial_description),
                codColigada: (0, normalize_1.toNullableString)(headerRow.cod_coligada),
                codFilial: (0, normalize_1.toNullableString)(headerRow.cod_filial),
                codUfOper: (0, normalize_1.toNullableString)(headerRow.cod_uf_oper),
                descUfOper: (0, normalize_1.toNullableString)(headerRow.desc_uf_oper),
                codMunOper: (0, normalize_1.toNullableString)(headerRow.cod_mun_oper),
                descMunOper: (0, normalize_1.toNullableString)(headerRow.desc_mun_oper),
                idOperacao: (0, normalize_1.toNullableString)(headerRow.id_operacao),
                numeroMov: (0, normalize_1.toNullableString)(headerRow.numero_mov),
                fornecedorDescription: (0, normalize_1.toNullableString)(headerRow.fornecedor_description),
                codCfo: (0, normalize_1.toNullableString)(headerRow.cod_cfo),
                codColCfo: (0, normalize_1.toNullableString)(headerRow.cod_col_cfo),
                cnpjCpf: (0, normalize_1.toNullableString)(headerRow.cnpj_cpf),
                dataEmissao: mapDateValue(headerRow.data_emissao),
                dataSaida: mapDateValue(headerRow.data_saida),
                localEstoqueDescription: (0, normalize_1.toNullableString)(headerRow.local_estoque_description),
                codLoc: (0, normalize_1.toNullableString)(headerRow.cod_loc),
                movimentoDescription: (0, normalize_1.toNullableString)(headerRow.movimento_description),
                codTmv: (0, normalize_1.toNullableString)(headerRow.cod_tmv),
                codTdo: (0, normalize_1.toNullableString)(headerRow.cod_tdo),
                serie: (0, normalize_1.toNullableString)(headerRow.serie_nf ?? headerRow.serie),
                idNat: (0, normalize_1.toNullableString)(headerRow.id_nat),
                codNat: (0, normalize_1.toNullableString)(headerRow.cod_nat),
                naturezaDescription: (0, normalize_1.toNullableString)(headerRow.natureza_description),
                qualidade: (0, normalize_1.toNullableNumber)(headerRow.qualidade),
                prazo: (0, normalize_1.toNullableNumber)(headerRow.prazo),
                atendimento: (0, normalize_1.toNullableNumber)(headerRow.atendimento),
                valorBruto: (0, normalize_1.toNullableNumber)(headerRow.valor_bruto),
                valorLiquido: (0, normalize_1.toNullableNumber)(headerRow.valor_liquido),
                valorFrete: (0, normalize_1.toNullableNumber)(headerRow.valor_frete),
                valorDesc: (0, normalize_1.toNullableNumber)(headerRow.valor_desc),
                valorDesp: (0, normalize_1.toNullableNumber)(headerRow.valor_desp),
                valorOutros: (0, normalize_1.toNullableNumber)(headerRow.valor_outros),
                chaveAcessoNfe: (0, normalize_1.toNullableString)(headerRow.chave_acesso_nfe),
                gerarFrap: Boolean(headerRow.gerar_frap),
                dataPrevBaixa: mapDateValue(headerRow.data_prev_baixa),
                historico: (0, normalize_1.toNullableString)(headerRow.historico),
                observacaoAvaliacao: (0, normalize_1.toNullableString)(headerRow.observacao_avaliacao),
                financeiro: Boolean(headerRow.financeiro),
                possuiAdiantamento: Boolean(headerRow.possui_adiantamento),
                codCpg: (0, normalize_1.toNullableString)(headerRow.cod_cpg),
                descricaoCodCpg: (0, normalize_1.toNullableString)(headerRow.descricao_cod_cpg),
                codCxa: (0, normalize_1.toNullableString)(headerRow.cod_cxa),
                descricaoCodCxa: (0, normalize_1.toNullableString)(headerRow.descricao_cod_cxa),
            },
            purchaseOrders: (recordsets[1] ?? []).map((row) => ({
                lineNumber: Number(row.line_number),
                seqF: (0, normalize_1.toNullableString)(row.seq_f),
                idMov: (0, normalize_1.toNullableString)(row.id_mov),
                numeroMov: (0, normalize_1.toNullableString)(row.numero_mov),
                codTmvOc: (0, normalize_1.toNullableString)(row.cod_tmv_oc),
                tipoMovimento: (0, normalize_1.toNullableString)(row.tipo_movimento),
                dataEmissao: mapDateValue(row.data_emissao),
                valor: (0, normalize_1.toNullableNumber)(row.valor),
                cgcCfo: (0, normalize_1.toNullableString)(row.cgc_cfo),
                fornecedorNome: (0, normalize_1.toNullableString)(row.fornecedor_nome),
                movimentoDestinoCodigo: (0, normalize_1.toNullableString)(row.movimento_destino_codigo),
                movimentoDestinoDescricao: (0, normalize_1.toNullableString)(row.movimento_destino_descricao),
            })),
            items: (recordsets[2] ?? []).map((row) => ({
                lineNumber: Number(row.line_number),
                seqF: (0, normalize_1.toNullableString)(row.seq_f),
                nomeFantasia: (0, normalize_1.toNullableString)(row.nome_fantasia),
                codigoPrd: (0, normalize_1.toNullableString)(row.codigo_prd),
                idPrd: (0, normalize_1.toNullableString)(row.id_prd),
                numNoFabric: (0, normalize_1.toNullableString)(row.num_no_fabric),
                tipo: (0, normalize_1.toNullableString)(row.tipo),
                codUnd: (0, normalize_1.toNullableString)(row.cod_und),
                nseqItmMov: (0, normalize_1.toNullableString)(row.nseq_itm_mov),
                idNat: (0, normalize_1.toNullableString)(row.id_nat),
                codNat: (0, normalize_1.toNullableString)(row.cod_nat),
                descNat: (0, normalize_1.toNullableString)(row.desc_nat),
                codColTborcamento: (0, normalize_1.toNullableString)(row.cod_col_tborcamento),
                codTborcamento: (0, normalize_1.toNullableString)(row.cod_tborcamento),
                descTborcamento: (0, normalize_1.toNullableString)(row.desc_tborcamento),
                idMovOc: (0, normalize_1.toNullableString)(row.id_mov_oc),
                nseqItmMovOc: (0, normalize_1.toNullableString)(row.nseq_itm_mov_oc),
                quantidade: (0, normalize_1.toNullableNumber)(row.quantidade),
                precoUnitario: (0, normalize_1.toNullableNumber)(row.preco_unitario),
                valorBrutoItem: (0, normalize_1.toNullableNumber)(row.valor_bruto_item),
                valorTotalItem: (0, normalize_1.toNullableNumber)(row.valor_total_item),
                valorLiquido: (0, normalize_1.toNullableNumber)(row.valor_liquido),
            })),
            apportionments: (recordsets[3] ?? []).map((row) => ({
                lineNumber: Number(row.line_number),
                seqF: (0, normalize_1.toNullableString)(row.seq_f),
                itemSeqF: (0, normalize_1.toNullableString)(row.item_seq_f),
                nseqItmMov: (0, normalize_1.toNullableString)(row.nseq_itm_mov),
                descCusto: (0, normalize_1.toNullableString)(row.desc_custo),
                codCcusto: (0, normalize_1.toNullableString)(row.cod_ccusto),
                valor: (0, normalize_1.toNullableNumber)(row.valor),
            })),
            taxes: (recordsets[4] ?? []).map((row) => ({
                lineNumber: Number(row.line_number),
                seqF: (0, normalize_1.toNullableString)(row.seq_f),
                itemSeqF: (0, normalize_1.toNullableString)(row.item_seq_f),
                nseqItmMov: (0, normalize_1.toNullableString)(row.nseq_itm_mov),
                codTrb: (0, normalize_1.toNullableString)(row.cod_trb),
                sitTributaria: (0, normalize_1.toNullableString)(row.sit_tributaria),
                baseDeCalculo: (0, normalize_1.toNullableNumber)(row.base_de_calculo),
                aliquota: (0, normalize_1.toNullableNumber)(row.aliquota),
                tipoRecolhimento: (0, normalize_1.toNullableString)(row.tipo_recolhimento),
                valor: (0, normalize_1.toNullableNumber)(row.valor),
            })),
            payments: (recordsets[5] ?? []).map((row) => ({
                lineNumber: Number(row.line_number),
                seqF: (0, normalize_1.toNullableString)(row.seq_f),
                codColigada: (0, normalize_1.toNullableString)(row.cod_coligada),
                idMov: (0, normalize_1.toNullableString)(row.id_mov),
                idSeqPagto: (0, normalize_1.toNullableString)(row.id_seq_pagto),
                dataVencimento: mapDateValue(row.data_vencimento),
                valor: (0, normalize_1.toNullableNumber)(row.valor),
                descFormaPagto: (0, normalize_1.toNullableString)(row.desc_forma_pagto),
                idFormaPagto: (0, normalize_1.toNullableString)(row.id_forma_pagto),
                tipoFormaPagto: (0, normalize_1.toNullableString)(row.tipo_forma_pagto),
                codColCxa: (0, normalize_1.toNullableString)(row.cod_col_cxa),
                descCodCxa: (0, normalize_1.toNullableString)(row.desc_cod_cxa),
                codCxa: (0, normalize_1.toNullableString)(row.cod_cxa),
                tipoPagamento: (0, normalize_1.toNullableString)(row.tipo_pagamento),
                debitoCredito: (0, normalize_1.toNullableString)(row.debito_credito),
                taxaAdm: (0, normalize_1.toNullableNumber)(row.taxa_adm),
                idLan: (0, normalize_1.toNullableString)(row.id_lan),
                adtIntegrado: (0, normalize_1.toNullableString)(row.adt_integrado),
                linhaDigitavel: (0, normalize_1.toNullableString)(row.linha_digitavel),
            })),
        };
        return this.applyAutomaticItemIdentifiers(normalizeItemSequences(entryRecord));
    }
    async createEntry(payload) {
        const now = new Date().toISOString();
        let entry = mapRecordFromInput((0, crypto_1.randomUUID)(), payload, now, now);
        if (entry.mode === 'submit') {
            entry = await this.applyAutomaticItemIdentifiers(entry);
        }
        (0, entryInvoiceValidationService_1.validateEntryRecord)(entry, entry.mode);
        await this.ensureDuplicate(entry);
        await (0, schemaService_1.ensureDatabaseStructure)();
        await this.persistEntry(entry, false);
        return this.getEntryById(entry.id);
    }
    async updateEntry(entryId, payload) {
        const existing = await this.getEntryById(entryId);
        if (existing.status === 'approved') {
            throw new errors_1.AppError(409, 'Notas ja aprovadas nao podem ser alteradas.', 'ENTRY_ALREADY_APPROVED');
        }
        const now = new Date().toISOString();
        let entry = mapRecordFromInput(entryId, payload, existing.createdAt, now, existing.createdBy);
        entry.reviewComment = existing.reviewComment;
        entry.approvedBy = existing.approvedBy;
        entry.approvedAt = existing.approvedAt;
        entry.rejectedBy = existing.rejectedBy;
        entry.rejectedAt = existing.rejectedAt;
        entry.rmMovementId = existing.rmMovementId;
        entry.rmPrimaryKey = existing.rmPrimaryKey;
        entry.rmIntegrationStatus = existing.rmIntegrationStatus;
        entry.rmIntegrationMessage = existing.rmIntegrationMessage;
        if (entry.mode === 'submit') {
            entry = await this.applyAutomaticItemIdentifiers(entry);
        }
        (0, entryInvoiceValidationService_1.validateEntryRecord)(entry, entry.mode);
        await this.ensureDuplicate(entry, entryId);
        await this.persistEntry(entry, true);
        return this.getEntryById(entryId);
    }
    async submitEntry(entryId, payload) {
        const sourceRecord = payload
            ? await this.updateEntry(entryId, { ...payload, mode: 'submit' })
            : await this.getEntryById(entryId);
        if (sourceRecord.status === 'approved') {
            throw new errors_1.AppError(409, 'Esta nota ja foi aprovada e integrada ao RM.', 'ENTRY_ALREADY_APPROVED');
        }
        let recordToSubmit = {
            ...sourceRecord,
            mode: 'submit',
            status: 'pending_analysis',
            reviewComment: null,
            approvedBy: null,
            approvedAt: null,
            rejectedBy: null,
            rejectedAt: null,
            rmIntegrationStatus: null,
            rmIntegrationMessage: null,
        };
        recordToSubmit = await this.applyAutomaticItemIdentifiers(recordToSubmit);
        (0, entryInvoiceValidationService_1.validateEntryRecord)(recordToSubmit, 'submit');
        await this.ensureDuplicate(recordToSubmit, entryId);
        await this.persistEntry(recordToSubmit, true);
        return this.getEntryById(entryId);
    }
    async approveEntry(entryId, review) {
        const sourceRecord = await this.getEntryById(entryId);
        if (!['pending_analysis', 'submitted'].includes(sourceRecord.status)) {
            throw new errors_1.AppError(409, 'Somente notas pendentes de analise podem ser aprovadas.', 'ENTRY_REVIEW_INVALID_STATUS');
        }
        try {
            const recordToApprove = await this.applyAutomaticItemIdentifiers(sourceRecord);
            if (recordToApprove !== sourceRecord) {
                await this.persistEntry(recordToApprove, true);
            }
            const integrationResult = await this.rmEntryInvoiceMovementService.integrate(recordToApprove);
            const reviewedBy = (0, normalize_1.toNullableString)(review.reviewedBy) ?? sourceRecord.updatedBy;
            const reviewedComment = (0, normalize_1.toNullableString)(review.comment);
            const approvedRecord = {
                ...recordToApprove,
                status: 'approved',
                reviewComment: reviewedComment,
                approvedBy: reviewedBy,
                approvedAt: new Date().toISOString(),
                rejectedBy: null,
                rejectedAt: null,
                rmMovementId: integrationResult.movementId,
                rmPrimaryKey: integrationResult.primaryKey,
                rmIntegrationStatus: 'integrated',
                rmIntegrationMessage: null,
                updatedBy: reviewedBy,
            };
            await this.persistEntry(approvedRecord, true);
            return this.getEntryById(entryId);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Falha desconhecida na integracao RM.';
            const details = { message };
            if (message.includes('Número Identificador inválido') || message.includes('Numero Identificador invalido')) {
                details.hint =
                    'O produto exige Numero Identificador no item. A API tentou inferir esse valor automaticamente a partir da O.C.; se ainda assim falhou, revise o cadastro ou o identificador do produto no RM.';
            }
            await this.updateReviewMetadata(entryId, {
                reviewComment: (0, normalize_1.toNullableString)(review.comment),
                rmIntegrationStatus: 'error',
                rmIntegrationMessage: message,
                updatedBy: (0, normalize_1.toNullableString)(review.reviewedBy) ?? sourceRecord.updatedBy,
            });
            throw new errors_1.AppError(502, 'Nao foi possivel integrar a nota no RM durante a aprovacao.', 'ENTRY_RM_INTEGRATION_ERROR', details);
        }
    }
    async rejectEntry(entryId, review) {
        const sourceRecord = await this.getEntryById(entryId);
        if (!['pending_analysis', 'submitted'].includes(sourceRecord.status)) {
            throw new errors_1.AppError(409, 'Somente notas pendentes de analise podem ser reprovadas.', 'ENTRY_REVIEW_INVALID_STATUS');
        }
        const reviewedBy = (0, normalize_1.toNullableString)(review.reviewedBy) ?? sourceRecord.updatedBy;
        const rejectedRecord = {
            ...sourceRecord,
            status: 'rejected',
            reviewComment: (0, normalize_1.toNullableString)(review.comment),
            approvedBy: null,
            approvedAt: null,
            rejectedBy: reviewedBy,
            rejectedAt: new Date().toISOString(),
            rmIntegrationStatus: 'rejected',
            rmIntegrationMessage: null,
            updatedBy: reviewedBy,
        };
        await this.persistEntry(rejectedRecord, true);
        return this.getEntryById(entryId);
    }
    async applyAutomaticItemIdentifiers(entry) {
        const codColigada = (0, normalize_1.toNullableString)(entry.header.codColigada);
        if (!codColigada) {
            return entry;
        }
        const itemsToResolve = entry.items.filter((item) => (!(0, normalize_1.hasValue)(item.numNoFabric) || !(0, normalize_1.hasValue)(item.tipo)) &&
            (0, normalize_1.hasValue)(item.idMovOc) &&
            (0, normalize_1.hasValue)(item.nseqItmMovOc));
        if (!itemsToResolve.length) {
            return entry;
        }
        const purchaseOrderIds = [
            ...new Set(itemsToResolve.map((item) => String(item.idMovOc).trim()).filter(Boolean)),
        ];
        if (!purchaseOrderIds.length) {
            return entry;
        }
        try {
            const lookupRows = await this.rmEntryInvoiceLookupService.getPurchaseOrderItems({
                CODCOLIGADA: codColigada,
                LISTIDMOV: purchaseOrderIds.join('-'),
                SEPARADOR: '-',
                IDMOVDESTEXCEP: '',
            });
            const itemDetailsByKey = new Map();
            for (const row of lookupRows) {
                const idMovOc = (0, normalize_1.toNullableString)(row.TITMMOV_T_IDMOV);
                const nseqItmMovOc = (0, normalize_1.toNullableString)(row.TITMMOV_T_NSEQITMMOV);
                const inferredIdentifier = (0, normalize_1.toNullableString)(row.TITMMOV_T_NUMNOFABRIC);
                const inferredType = (0, normalize_1.toNullableString)(row.TITMMOV_T_TIPO);
                if (!idMovOc || !nseqItmMovOc) {
                    continue;
                }
                itemDetailsByKey.set(`${idMovOc}_${nseqItmMovOc}`, {
                    numNoFabric: inferredIdentifier,
                    tipo: inferredType,
                });
            }
            let changed = false;
            const items = entry.items.map((item) => {
                if (!item.idMovOc || !item.nseqItmMovOc) {
                    return item;
                }
                const inferredItemDetails = itemDetailsByKey.get(`${String(item.idMovOc).trim()}_${String(item.nseqItmMovOc).trim()}`);
                if (!inferredItemDetails) {
                    return item;
                }
                if ((0, normalize_1.hasValue)(item.numNoFabric) === (0, normalize_1.hasValue)(inferredItemDetails.numNoFabric) &&
                    (0, normalize_1.toNullableString)(item.numNoFabric) === inferredItemDetails.numNoFabric &&
                    (0, normalize_1.toNullableString)(item.tipo) === inferredItemDetails.tipo) {
                    return item;
                }
                changed = true;
                return {
                    ...item,
                    numNoFabric: (0, normalize_1.hasValue)(item.numNoFabric)
                        ? item.numNoFabric
                        : inferredItemDetails.numNoFabric,
                    tipo: (0, normalize_1.hasValue)(item.tipo) ? item.tipo : inferredItemDetails.tipo,
                };
            });
            if (!changed) {
                return entry;
            }
            return {
                ...entry,
                items,
                updatedAt: new Date().toISOString(),
            };
        }
        catch {
            return entry;
        }
    }
    async deleteEntry(entryId) {
        await (0, schemaService_1.ensureDatabaseStructure)();
        const pool = await (0, db_1.getPool)();
        const request = pool.request();
        request.input('entryId', entryId);
        const result = await request.query(`
      UPDATE ${tableName('entries')}
      SET deleted_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
      WHERE id = @entryId
        AND deleted_at IS NULL;

      SELECT @@ROWCOUNT AS affectedRows;
    `);
        const recordsets = result.recordsets;
        const affectedRows = Number(recordsets?.[0]?.[0]?.affectedRows ?? 0);
        if (!affectedRows) {
            throw new errors_1.AppError(404, 'Registro de Entrada de Nota Fiscal nao encontrado.', 'ENTRY_NOT_FOUND');
        }
    }
    async ensureDuplicate(entry, excludeId) {
        if (!(0, normalize_1.hasValue)(entry.header.codColigada) ||
            !(0, normalize_1.hasValue)(entry.header.codFilial) ||
            !(0, normalize_1.hasValue)(entry.header.codColCfo) ||
            !(0, normalize_1.hasValue)(entry.header.codCfo) ||
            !(0, normalize_1.hasValue)(entry.header.numeroMov) ||
            !(0, normalize_1.hasValue)(entry.header.serie)) {
            return;
        }
        await (0, schemaService_1.ensureDatabaseStructure)();
        const pool = await (0, db_1.getPool)();
        const request = pool.request();
        request.input('entryId', excludeId ?? null);
        request.input('codColigada', entry.header.codColigada);
        request.input('codFilial', entry.header.codFilial);
        request.input('codColCfo', entry.header.codColCfo);
        request.input('codCfo', entry.header.codCfo);
        request.input('numeroMov', entry.header.numeroMov);
        request.input('serie', entry.header.serie);
        const result = await request.query(`
      SELECT TOP 1 id
      FROM ${tableName('entries')}
      WHERE deleted_at IS NULL
        AND cod_coligada = @codColigada
        AND cod_filial = @codFilial
        AND cod_col_cfo = @codColCfo
        AND cod_cfo = @codCfo
        AND numero_mov = @numeroMov
        AND serie = @serie
        AND (@entryId IS NULL OR id <> @entryId);
    `);
        if (result.recordset.length > 0) {
            throw new errors_1.AppError(409, 'Ja existe uma Entrada de Nota Fiscal cadastrada para essa combinacao de fornecedor, filial, numero e serie.', 'ENTRY_DUPLICATED');
        }
    }
    async updateReviewMetadata(entryId, metadata) {
        await (0, schemaService_1.ensureDatabaseStructure)();
        const pool = await (0, db_1.getPool)();
        const request = pool.request();
        request.input('entryId', entryId);
        request.input('reviewComment', metadata.reviewComment ?? null);
        request.input('rmIntegrationStatus', metadata.rmIntegrationStatus ?? null);
        request.input('rmIntegrationMessage', metadata.rmIntegrationMessage ?? null);
        request.input('updatedBy', metadata.updatedBy ?? null);
        await request.query(`
      UPDATE ${tableName('entries')}
      SET
        review_comment = @reviewComment,
        rm_integration_status = @rmIntegrationStatus,
        rm_integration_message = @rmIntegrationMessage,
        updated_by = COALESCE(@updatedBy, updated_by),
        updated_at = SYSUTCDATETIME()
      WHERE id = @entryId
        AND deleted_at IS NULL;
    `);
    }
    async persistEntry(entry, isUpdate) {
        await (0, schemaService_1.ensureDatabaseStructure)();
        const pool = await (0, db_1.getPool)();
        const transaction = await pool.transaction();
        try {
            await transaction.begin();
            const request = transaction.request();
            request.input('id', entry.id);
            request.input('status', entry.status);
            request.input('numeroMov', entry.header.numeroMov);
            request.input('serie', entry.header.serie);
            request.input('codColigada', entry.header.codColigada);
            request.input('codFilial', entry.header.codFilial);
            request.input('codUfOper', entry.header.codUfOper);
            request.input('descUfOper', entry.header.descUfOper);
            request.input('codMunOper', entry.header.codMunOper);
            request.input('descMunOper', entry.header.descMunOper);
            request.input('idOperacao', entry.header.idOperacao);
            request.input('filialDescription', entry.header.filialDescription);
            request.input('codColCfo', entry.header.codColCfo);
            request.input('codCfo', entry.header.codCfo);
            request.input('fornecedorDescription', entry.header.fornecedorDescription);
            request.input('cnpjCpf', entry.header.cnpjCpf);
            request.input('dataEmissao', entry.header.dataEmissao);
            request.input('dataSaida', entry.header.dataSaida);
            request.input('localEstoqueDescription', entry.header.localEstoqueDescription);
            request.input('codLoc', entry.header.codLoc);
            request.input('codTmv', entry.header.codTmv);
            request.input('codTdo', entry.header.codTdo);
            request.input('movimentoDescription', entry.header.movimentoDescription);
            request.input('serieNf', entry.header.serie);
            request.input('idNat', entry.header.idNat);
            request.input('codNat', entry.header.codNat);
            request.input('naturezaDescription', entry.header.naturezaDescription);
            request.input('qualidade', entry.header.qualidade);
            request.input('prazo', entry.header.prazo);
            request.input('atendimento', entry.header.atendimento);
            request.input('valorBruto', entry.header.valorBruto);
            request.input('valorLiquido', entry.header.valorLiquido);
            request.input('valorFrete', entry.header.valorFrete);
            request.input('valorDesc', entry.header.valorDesc);
            request.input('valorDesp', entry.header.valorDesp);
            request.input('valorOutros', entry.header.valorOutros);
            request.input('chaveAcessoNfe', entry.header.chaveAcessoNfe);
            request.input('gerarFrap', entry.header.gerarFrap);
            request.input('dataPrevBaixa', entry.header.dataPrevBaixa);
            request.input('historico', entry.header.historico);
            request.input('observacaoAvaliacao', entry.header.observacaoAvaliacao);
            request.input('financeiro', entry.header.financeiro);
            request.input('possuiAdiantamento', entry.header.possuiAdiantamento);
            request.input('codCpg', entry.header.codCpg);
            request.input('descricaoCodCpg', entry.header.descricaoCodCpg);
            request.input('codCxa', entry.header.codCxa);
            request.input('descricaoCodCxa', entry.header.descricaoCodCxa);
            request.input('payloadJson', JSON.stringify({
                mode: entry.mode,
                requestedBy: entry.requestedBy,
            }));
            request.input('createdBy', entry.createdBy);
            request.input('updatedBy', entry.updatedBy ?? entry.requestedBy);
            request.input('reviewComment', entry.reviewComment);
            request.input('approvedBy', entry.approvedBy);
            request.input('approvedAt', entry.approvedAt);
            request.input('rejectedBy', entry.rejectedBy);
            request.input('rejectedAt', entry.rejectedAt);
            request.input('rmMovementId', entry.rmMovementId);
            request.input('rmPrimaryKey', entry.rmPrimaryKey);
            request.input('rmIntegrationStatus', entry.rmIntegrationStatus);
            request.input('rmIntegrationMessage', entry.rmIntegrationMessage);
            if (isUpdate) {
                await request.query(`
          UPDATE ${tableName('entries')}
          SET
            status = @status,
            numero_mov = @numeroMov,
            serie = @serie,
            cod_coligada = @codColigada,
            cod_filial = @codFilial,
            cod_uf_oper = @codUfOper,
            desc_uf_oper = @descUfOper,
            cod_mun_oper = @codMunOper,
            desc_mun_oper = @descMunOper,
            id_operacao = @idOperacao,
            filial_description = @filialDescription,
            cod_col_cfo = @codColCfo,
            cod_cfo = @codCfo,
            fornecedor_description = @fornecedorDescription,
            cnpj_cpf = @cnpjCpf,
            data_emissao = @dataEmissao,
            data_saida = @dataSaida,
            local_estoque_description = @localEstoqueDescription,
            cod_loc = @codLoc,
            cod_tmv = @codTmv,
            cod_tdo = @codTdo,
            movimento_description = @movimentoDescription,
            serie_nf = @serieNf,
            id_nat = @idNat,
            cod_nat = @codNat,
            natureza_description = @naturezaDescription,
            qualidade = @qualidade,
            prazo = @prazo,
            atendimento = @atendimento,
            valor_bruto = @valorBruto,
            valor_liquido = @valorLiquido,
            valor_frete = @valorFrete,
            valor_desc = @valorDesc,
            valor_desp = @valorDesp,
            valor_outros = @valorOutros,
            chave_acesso_nfe = @chaveAcessoNfe,
            gerar_frap = @gerarFrap,
            data_prev_baixa = @dataPrevBaixa,
            historico = @historico,
            observacao_avaliacao = @observacaoAvaliacao,
            financeiro = @financeiro,
            possui_adiantamento = @possuiAdiantamento,
            cod_cpg = @codCpg,
            descricao_cod_cpg = @descricaoCodCpg,
            cod_cxa = @codCxa,
            descricao_cod_cxa = @descricaoCodCxa,
            payload_json = @payloadJson,
            review_comment = @reviewComment,
            approved_by = @approvedBy,
            approved_at = @approvedAt,
            rejected_by = @rejectedBy,
            rejected_at = @rejectedAt,
            rm_movement_id = @rmMovementId,
            rm_primary_key = @rmPrimaryKey,
            rm_integration_status = @rmIntegrationStatus,
            rm_integration_message = @rmIntegrationMessage,
            updated_by = @updatedBy,
            updated_at = SYSUTCDATETIME()
          WHERE id = @id;
        `);
                await transaction.request().input('entryId', entry.id).query(`
          DELETE FROM ${tableName('purchase_orders')} WHERE entry_id = @entryId;
          DELETE FROM ${tableName('items')} WHERE entry_id = @entryId;
          DELETE FROM ${tableName('apportionments')} WHERE entry_id = @entryId;
          DELETE FROM ${tableName('taxes')} WHERE entry_id = @entryId;
          DELETE FROM ${tableName('payments')} WHERE entry_id = @entryId;
        `);
            }
            else {
                await request.query(`
          INSERT INTO ${tableName('entries')} (
            id, status, numero_mov, serie, cod_coligada, cod_filial, cod_uf_oper, desc_uf_oper, cod_mun_oper, desc_mun_oper, id_operacao, filial_description,
            cod_col_cfo, cod_cfo, fornecedor_description, cnpj_cpf, data_emissao, data_saida,
            local_estoque_description, cod_loc, cod_tmv, cod_tdo, movimento_description, serie_nf, id_nat, cod_nat, natureza_description,
            qualidade, prazo, atendimento, valor_bruto, valor_liquido, valor_frete, valor_desc,
            valor_desp, valor_outros, chave_acesso_nfe, gerar_frap, data_prev_baixa, historico,
            observacao_avaliacao, financeiro, possui_adiantamento, cod_cpg, descricao_cod_cpg,
            cod_cxa, descricao_cod_cxa, payload_json, created_by, updated_by, review_comment,
            approved_by, approved_at, rejected_by, rejected_at, rm_movement_id, rm_primary_key,
            rm_integration_status, rm_integration_message
          ) VALUES (
            @id, @status, @numeroMov, @serie, @codColigada, @codFilial, @codUfOper, @descUfOper, @codMunOper, @descMunOper, @idOperacao, @filialDescription,
            @codColCfo, @codCfo, @fornecedorDescription, @cnpjCpf, @dataEmissao, @dataSaida,
            @localEstoqueDescription, @codLoc, @codTmv, @codTdo, @movimentoDescription, @serieNf, @idNat, @codNat, @naturezaDescription,
            @qualidade, @prazo, @atendimento, @valorBruto, @valorLiquido, @valorFrete, @valorDesc,
            @valorDesp, @valorOutros, @chaveAcessoNfe, @gerarFrap, @dataPrevBaixa, @historico,
            @observacaoAvaliacao, @financeiro, @possuiAdiantamento, @codCpg, @descricaoCodCpg,
            @codCxa, @descricaoCodCxa, @payloadJson, @createdBy, @updatedBy, @reviewComment,
            @approvedBy, @approvedAt, @rejectedBy, @rejectedAt, @rmMovementId, @rmPrimaryKey,
            @rmIntegrationStatus, @rmIntegrationMessage
          );
        `);
            }
            await this.insertCollection(transaction, 'purchase_orders', entry.id, entry.purchaseOrders.map((row) => ({
                line_number: row.lineNumber,
                seq_f: row.seqF,
                id_mov: row.idMov,
                numero_mov: row.numeroMov,
                cod_tmv_oc: row.codTmvOc,
                tipo_movimento: row.tipoMovimento,
                data_emissao: row.dataEmissao,
                valor: row.valor,
                cgc_cfo: row.cgcCfo,
                fornecedor_nome: row.fornecedorNome,
                movimento_destino_codigo: row.movimentoDestinoCodigo,
                movimento_destino_descricao: row.movimentoDestinoDescricao,
            })));
            await this.insertCollection(transaction, 'items', entry.id, entry.items.map((row) => ({
                line_number: row.lineNumber,
                seq_f: row.seqF,
                nome_fantasia: row.nomeFantasia,
                codigo_prd: row.codigoPrd,
                id_prd: row.idPrd,
                num_no_fabric: row.numNoFabric,
                tipo: row.tipo,
                cod_und: row.codUnd,
                nseq_itm_mov: row.nseqItmMov,
                id_nat: row.idNat,
                cod_nat: row.codNat,
                desc_nat: row.descNat,
                cod_col_tborcamento: row.codColTborcamento,
                cod_tborcamento: row.codTborcamento,
                desc_tborcamento: row.descTborcamento,
                id_mov_oc: row.idMovOc,
                nseq_itm_mov_oc: row.nseqItmMovOc,
                quantidade: row.quantidade,
                preco_unitario: row.precoUnitario,
                valor_bruto_item: row.valorBrutoItem,
                valor_total_item: row.valorTotalItem,
                valor_liquido: row.valorLiquido,
            })));
            await this.insertCollection(transaction, 'apportionments', entry.id, entry.apportionments.map((row) => ({
                line_number: row.lineNumber,
                seq_f: row.seqF,
                item_seq_f: row.itemSeqF,
                nseq_itm_mov: row.nseqItmMov,
                desc_custo: row.descCusto,
                cod_ccusto: row.codCcusto,
                valor: row.valor,
            })));
            await this.insertCollection(transaction, 'taxes', entry.id, entry.taxes.map((row) => ({
                line_number: row.lineNumber,
                seq_f: row.seqF,
                item_seq_f: row.itemSeqF,
                nseq_itm_mov: row.nseqItmMov,
                cod_trb: row.codTrb,
                sit_tributaria: row.sitTributaria,
                base_de_calculo: row.baseDeCalculo,
                aliquota: row.aliquota,
                tipo_recolhimento: row.tipoRecolhimento,
                valor: row.valor,
            })));
            await this.insertCollection(transaction, 'payments', entry.id, entry.payments.map((row) => ({
                line_number: row.lineNumber,
                seq_f: row.seqF,
                cod_coligada: row.codColigada,
                id_mov: row.idMov,
                id_seq_pagto: row.idSeqPagto,
                data_vencimento: row.dataVencimento,
                valor: row.valor,
                desc_forma_pagto: row.descFormaPagto,
                id_forma_pagto: row.idFormaPagto,
                tipo_forma_pagto: row.tipoFormaPagto,
                cod_col_cxa: row.codColCxa,
                desc_cod_cxa: row.descCodCxa,
                cod_cxa: row.codCxa,
                tipo_pagamento: row.tipoPagamento,
                debito_credito: row.debitoCredito,
                taxa_adm: row.taxaAdm,
                id_lan: row.idLan,
                adt_integrado: row.adtIntegrado,
                linha_digitavel: row.linhaDigitavel,
            })));
            await transaction.commit();
        }
        catch (error) {
            try {
                await transaction.rollback();
            }
            catch {
                // ignore rollback error
            }
            throw error;
        }
    }
    async insertCollection(transaction, tableSuffix, entryId, rows) {
        const table = tableName(tableSuffix);
        for (const row of rows) {
            const request = transaction.request();
            request.input('id', (0, crypto_1.randomUUID)());
            request.input('entryId', entryId);
            const columns = ['id', 'entry_id'];
            const params = ['@id', '@entryId'];
            Object.entries(row).forEach(([column, value]) => {
                const paramName = `p_${column}`;
                columns.push(column);
                params.push(`@${paramName}`);
                request.input(paramName, value);
            });
            await request.query(`
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES (${params.join(', ')});
      `);
        }
    }
}
exports.EntryInvoiceService = EntryInvoiceService;
