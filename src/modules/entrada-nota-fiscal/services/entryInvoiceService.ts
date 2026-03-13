import { randomUUID } from 'crypto';
import type sql from 'mssql';
import { env } from '../config/env';
import { getPool } from '../config/db';
import { AppError } from '../types/errors';
import type {
  EntryApportionment,
  EntryHeader,
  EntryItem,
  EntryListItem,
  EntryListQuery,
  EntryListResponse,
  EntryPayment,
  EntryPurchaseOrder,
  EntryRecord,
  EntryRecordInput,
  EntryReviewInput,
  EntryStatus,
  EntryTax,
  FormMetadataResponse,
  SaveMode,
} from '../types/models';
import {
  hasValue,
  toBoolean,
  toDateOnly,
  toNullableNumber,
  toNullableString,
} from '../utils/normalize';
import { ensureDatabaseStructure } from './schemaService';
import { validateEntryRecord } from './entryInvoiceValidationService';
import { RmEntryInvoiceMovementService } from '../../rm/services/RmEntryInvoiceMovementService';
import { RmEntryInvoiceLookupService } from '../../rm/services/RmEntryInvoiceLookupService';

type RowMap = Record<string, string | number | boolean | null>;
type DbRow = Record<string, unknown>;

function quoteIdentifier(identifier: string): string {
  return `[${identifier}]`;
}

function tableName(suffix: string): string {
  return `${quoteIdentifier(env.DB_SCHEMA)}.${quoteIdentifier(`${env.TABLE_PREFIX}_${suffix}`)}`;
}

function normalizeLineNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeMode(value: unknown): SaveMode {
  const normalized = String(value ?? '').toLowerCase();
  return normalized === 'submit' ||
    normalized === 'submitted' ||
    normalized === 'pending_analysis' ||
    normalized === 'approved' ||
    normalized === 'rejected'
    ? 'submit'
    : 'draft';
}

function normalizeStatus(mode: SaveMode): EntryStatus {
  return mode === 'submit' ? 'pending_analysis' : 'draft';
}

function normalizePersistedStatus(value: unknown): EntryStatus {
  const normalized = String(value ?? '').toLowerCase();

  if (normalized === 'submitted') {
    return 'pending_analysis';
  }

  if (
    normalized === 'draft' ||
    normalized === 'pending_analysis' ||
    normalized === 'approved' ||
    normalized === 'rejected'
  ) {
    return normalized;
  }

  return 'draft';
}

function mapDateValue(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function mapDateTimeValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(String(value)).toISOString();
}

function parsePayloadJson(row: Record<string, unknown>): Partial<EntryRecordInput> {
  const rawPayload = row.payload_json;
  if (!rawPayload || typeof rawPayload !== 'string') {
    return {};
  }

  try {
    return JSON.parse(rawPayload) as Partial<EntryRecordInput>;
  } catch {
    return {};
  }
}

function mapHeader(input: EntryRecordInput['header']): EntryHeader {
  return {
    filialDescription: toNullableString(input?.filialDescription),
    codColigada: toNullableString(input?.codColigada),
    codFilial: toNullableString(input?.codFilial),
    numeroMov: toNullableString(input?.numeroMov),
    fornecedorDescription: toNullableString(input?.fornecedorDescription),
    codCfo: toNullableString(input?.codCfo),
    codColCfo: toNullableString(input?.codColCfo),
    cnpjCpf: toNullableString(input?.cnpjCpf),
    dataEmissao: toDateOnly(input?.dataEmissao),
    dataSaida: toDateOnly(input?.dataSaida),
    localEstoqueDescription: toNullableString(input?.localEstoqueDescription),
    codLoc: toNullableString(input?.codLoc),
    movimentoDescription: toNullableString(input?.movimentoDescription),
    codTmv: toNullableString(input?.codTmv),
    codTdo: toNullableString(input?.codTdo),
    serie: toNullableString(input?.serie),
    idNat: toNullableString(input?.idNat),
    codNat: toNullableString(input?.codNat),
    naturezaDescription: toNullableString(input?.naturezaDescription),
    qualidade: toNullableNumber(input?.qualidade),
    prazo: toNullableNumber(input?.prazo),
    atendimento: toNullableNumber(input?.atendimento),
    valorBruto: toNullableNumber(input?.valorBruto),
    valorLiquido: toNullableNumber(input?.valorLiquido),
    valorFrete: toNullableNumber(input?.valorFrete),
    valorDesc: toNullableNumber(input?.valorDesc),
    valorDesp: toNullableNumber(input?.valorDesp),
    valorOutros: toNullableNumber(input?.valorOutros),
    chaveAcessoNfe: toNullableString(input?.chaveAcessoNfe),
    gerarFrap: toBoolean(input?.gerarFrap),
    dataPrevBaixa: toDateOnly(input?.dataPrevBaixa),
    historico: toNullableString(input?.historico),
    observacaoAvaliacao: toNullableString(input?.observacaoAvaliacao),
    financeiro: toBoolean(input?.financeiro),
    possuiAdiantamento: toBoolean(input?.possuiAdiantamento),
    codCpg: toNullableString(input?.codCpg),
    descricaoCodCpg: toNullableString(input?.descricaoCodCpg),
    codCxa: toNullableString(input?.codCxa),
    descricaoCodCxa: toNullableString(input?.descricaoCodCxa),
  };
}

function mapPurchaseOrders(items: EntryRecordInput['purchaseOrders']): EntryPurchaseOrder[] {
  return (items ?? []).map((item, index) => ({
    lineNumber: normalizeLineNumber(item?.lineNumber, index + 1),
    seqF: toNullableString(item?.seqF),
    idMov: toNullableString(item?.idMov),
    numeroMov: toNullableString(item?.numeroMov),
    codTmvOc: toNullableString(item?.codTmvOc),
    tipoMovimento: toNullableString(item?.tipoMovimento),
    dataEmissao: toDateOnly(item?.dataEmissao),
    valor: toNullableNumber(item?.valor),
    cgcCfo: toNullableString(item?.cgcCfo),
    fornecedorNome: toNullableString(item?.fornecedorNome),
    movimentoDestinoCodigo: toNullableString(item?.movimentoDestinoCodigo),
    movimentoDestinoDescricao: toNullableString(item?.movimentoDestinoDescricao),
  }));
}

function mapItems(items: EntryRecordInput['items'], header?: EntryHeader): EntryItem[] {
  const fallbackIdNat = toNullableString(header?.idNat);
  const fallbackCodNat = toNullableString(header?.codNat);
  const fallbackDescNat = toNullableString(header?.naturezaDescription);

  return (items ?? []).map((item, index) => ({
    lineNumber: normalizeLineNumber(item?.lineNumber, index + 1),
    seqF: toNullableString(item?.seqF),
    nomeFantasia: toNullableString(item?.nomeFantasia),
    codigoPrd: toNullableString(item?.codigoPrd),
    idPrd: toNullableString(item?.idPrd),
    numNoFabric: toNullableString(item?.numNoFabric),
    codUnd: toNullableString(item?.codUnd),
    nseqItmMov: toNullableString(item?.nseqItmMov),
    idNat: toNullableString(item?.idNat) ?? fallbackIdNat,
    codNat: toNullableString(item?.codNat) ?? fallbackCodNat,
    descNat: toNullableString(item?.descNat) ?? fallbackDescNat,
    codColTborcamento: toNullableString(item?.codColTborcamento),
    codTborcamento: toNullableString(item?.codTborcamento),
    descTborcamento: toNullableString(item?.descTborcamento) ?? toNullableString(item?.codTborcamento),
    idMovOc: toNullableString(item?.idMovOc),
    nseqItmMovOc: toNullableString(item?.nseqItmMovOc),
    quantidade: toNullableNumber(item?.quantidade),
    precoUnitario: toNullableNumber(item?.precoUnitario),
    valorBrutoItem: toNullableNumber(item?.valorBrutoItem),
    valorTotalItem: toNullableNumber(item?.valorTotalItem),
    valorLiquido: toNullableNumber(item?.valorLiquido),
  }));
}

function mapApportionments(items: EntryRecordInput['apportionments']): EntryApportionment[] {
  return (items ?? []).map((item, index) => ({
    lineNumber: normalizeLineNumber(item?.lineNumber, index + 1),
    seqF: toNullableString(item?.seqF),
    itemSeqF: toNullableString(item?.itemSeqF),
    nseqItmMov: toNullableString(item?.nseqItmMov),
    descCusto: toNullableString(item?.descCusto),
    codCcusto: toNullableString(item?.codCcusto),
    valor: toNullableNumber(item?.valor),
  }));
}

function mapTaxes(items: EntryRecordInput['taxes']): EntryTax[] {
  return (items ?? []).map((item, index) => ({
    lineNumber: normalizeLineNumber(item?.lineNumber, index + 1),
    seqF: toNullableString(item?.seqF),
    itemSeqF: toNullableString(item?.itemSeqF),
    nseqItmMov: toNullableString(item?.nseqItmMov),
    codTrb: toNullableString(item?.codTrb),
    sitTributaria: toNullableString(item?.sitTributaria),
    baseDeCalculo: toNullableNumber(item?.baseDeCalculo),
    aliquota: toNullableNumber(item?.aliquota),
    tipoRecolhimento: toNullableString(item?.tipoRecolhimento) ?? '1',
    valor: toNullableNumber(item?.valor),
  }));
}

function mapPayments(items: EntryRecordInput['payments']): EntryPayment[] {
  return (items ?? []).map((item, index) => ({
    lineNumber: normalizeLineNumber(item?.lineNumber, index + 1),
    seqF: toNullableString(item?.seqF),
    codColigada: toNullableString(item?.codColigada),
    idMov: toNullableString(item?.idMov),
    idSeqPagto: toNullableString(item?.idSeqPagto),
    dataVencimento: toDateOnly(item?.dataVencimento),
    valor: toNullableNumber(item?.valor),
    descFormaPagto: toNullableString(item?.descFormaPagto),
    idFormaPagto: toNullableString(item?.idFormaPagto),
    tipoFormaPagto: toNullableString(item?.tipoFormaPagto),
    codColCxa: toNullableString(item?.codColCxa),
    descCodCxa: toNullableString(item?.descCodCxa),
    codCxa: toNullableString(item?.codCxa),
    tipoPagamento: toNullableString(item?.tipoPagamento) ?? '1',
    debitoCredito: toNullableString(item?.debitoCredito) ?? 'C',
    taxaAdm: toNullableNumber(item?.taxaAdm),
    idLan: toNullableString(item?.idLan),
    adtIntegrado: toNullableString(item?.adtIntegrado) ?? 'nao',
    linhaDigitavel: toNullableString(item?.linhaDigitavel),
  }));
}

function mapRecordFromInput(
  id: string,
  payload: EntryRecordInput,
  createdAt: string,
  updatedAt: string,
  createdBy?: string | null
): EntryRecord {
  const mode = normalizeMode(payload.mode);
  const requestedBy = toNullableString(payload.requestedBy);
  const normalizedHeader = mapHeader(payload.header);

  return {
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
  };
}

export class EntryInvoiceService {
  private readonly rmEntryInvoiceMovementService = new RmEntryInvoiceMovementService();
  private readonly rmEntryInvoiceLookupService = new RmEntryInvoiceLookupService();

  public getFormMetadata(): FormMetadataResponse {
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

  public async listEntries(query: EntryListQuery): Promise<EntryListResponse> {
    await ensureDatabaseStructure();

    const pool = await getPool();
    const request = pool.request();
    const search = toNullableString(query.search);
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
    const recordsets = result.recordsets as DbRow[][];

    const items = (recordsets[0] ?? []).map((row): EntryListItem => ({
      id: String(row.id),
      status: normalizePersistedStatus(row.status),
      numeroMov: toNullableString(row.numero_mov),
      serie: toNullableString(row.serie),
      fornecedorDescription: toNullableString(row.fornecedor_description),
      filialDescription: toNullableString(row.filial_description),
      dataEmissao: mapDateValue(row.data_emissao),
      valorLiquido: toNullableNumber(row.valor_liquido),
      requestedBy:
        toNullableString(parsePayloadJson(row).requestedBy) ?? toNullableString(row.created_by),
      rmMovementId: toNullableString(row.rm_movement_id),
      reviewComment: toNullableString(row.review_comment),
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

  public async getEntryById(entryId: string): Promise<EntryRecord> {
    await ensureDatabaseStructure();

    const pool = await getPool();
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
    const recordsets = result.recordsets as DbRow[][];

    const headerRow = recordsets[0]?.[0];
    if (!headerRow) {
      throw new AppError(404, 'Registro de Entrada de Nota Fiscal nao encontrado.', 'ENTRY_NOT_FOUND');
    }

    const payload = parsePayloadJson(headerRow);
    const mode = normalizeMode(payload.mode ?? headerRow.status);

    return {
      id: String(headerRow.id),
      status: normalizePersistedStatus(headerRow.status),
      mode,
      requestedBy: toNullableString(payload.requestedBy),
      createdBy: toNullableString(headerRow.created_by),
      updatedBy: toNullableString(headerRow.updated_by),
      reviewComment: toNullableString(headerRow.review_comment),
      approvedBy: toNullableString(headerRow.approved_by),
      approvedAt: headerRow.approved_at ? mapDateTimeValue(headerRow.approved_at) : null,
      rejectedBy: toNullableString(headerRow.rejected_by),
      rejectedAt: headerRow.rejected_at ? mapDateTimeValue(headerRow.rejected_at) : null,
      rmMovementId: toNullableString(headerRow.rm_movement_id),
      rmPrimaryKey: toNullableString(headerRow.rm_primary_key),
      rmIntegrationStatus: toNullableString(headerRow.rm_integration_status),
      rmIntegrationMessage: toNullableString(headerRow.rm_integration_message),
      createdAt: mapDateTimeValue(headerRow.created_at),
      updatedAt: mapDateTimeValue(headerRow.updated_at),
      header: {
        filialDescription: toNullableString(headerRow.filial_description),
        codColigada: toNullableString(headerRow.cod_coligada),
        codFilial: toNullableString(headerRow.cod_filial),
        numeroMov: toNullableString(headerRow.numero_mov),
        fornecedorDescription: toNullableString(headerRow.fornecedor_description),
        codCfo: toNullableString(headerRow.cod_cfo),
        codColCfo: toNullableString(headerRow.cod_col_cfo),
        cnpjCpf: toNullableString(headerRow.cnpj_cpf),
        dataEmissao: mapDateValue(headerRow.data_emissao),
        dataSaida: mapDateValue(headerRow.data_saida),
        localEstoqueDescription: toNullableString(headerRow.local_estoque_description),
        codLoc: toNullableString(headerRow.cod_loc),
        movimentoDescription: toNullableString(headerRow.movimento_description),
        codTmv: toNullableString(headerRow.cod_tmv),
        codTdo: toNullableString(headerRow.cod_tdo),
        serie: toNullableString(headerRow.serie_nf ?? headerRow.serie),
        idNat: toNullableString(headerRow.id_nat),
        codNat: toNullableString(headerRow.cod_nat),
        naturezaDescription: toNullableString(headerRow.natureza_description),
        qualidade: toNullableNumber(headerRow.qualidade),
        prazo: toNullableNumber(headerRow.prazo),
        atendimento: toNullableNumber(headerRow.atendimento),
        valorBruto: toNullableNumber(headerRow.valor_bruto),
        valorLiquido: toNullableNumber(headerRow.valor_liquido),
        valorFrete: toNullableNumber(headerRow.valor_frete),
        valorDesc: toNullableNumber(headerRow.valor_desc),
        valorDesp: toNullableNumber(headerRow.valor_desp),
        valorOutros: toNullableNumber(headerRow.valor_outros),
        chaveAcessoNfe: toNullableString(headerRow.chave_acesso_nfe),
        gerarFrap: Boolean(headerRow.gerar_frap),
        dataPrevBaixa: mapDateValue(headerRow.data_prev_baixa),
        historico: toNullableString(headerRow.historico),
        observacaoAvaliacao: toNullableString(headerRow.observacao_avaliacao),
        financeiro: Boolean(headerRow.financeiro),
        possuiAdiantamento: Boolean(headerRow.possui_adiantamento),
        codCpg: toNullableString(headerRow.cod_cpg),
        descricaoCodCpg: toNullableString(headerRow.descricao_cod_cpg),
        codCxa: toNullableString(headerRow.cod_cxa),
        descricaoCodCxa: toNullableString(headerRow.descricao_cod_cxa),
      },
      purchaseOrders: (recordsets[1] ?? []).map((row): EntryPurchaseOrder => ({
        lineNumber: Number(row.line_number),
        seqF: toNullableString(row.seq_f),
        idMov: toNullableString(row.id_mov),
        numeroMov: toNullableString(row.numero_mov),
        codTmvOc: toNullableString(row.cod_tmv_oc),
        tipoMovimento: toNullableString(row.tipo_movimento),
        dataEmissao: mapDateValue(row.data_emissao),
        valor: toNullableNumber(row.valor),
        cgcCfo: toNullableString(row.cgc_cfo),
        fornecedorNome: toNullableString(row.fornecedor_nome),
        movimentoDestinoCodigo: toNullableString(row.movimento_destino_codigo),
        movimentoDestinoDescricao: toNullableString(row.movimento_destino_descricao),
      })),
      items: (recordsets[2] ?? []).map((row): EntryItem => ({
        lineNumber: Number(row.line_number),
        seqF: toNullableString(row.seq_f),
        nomeFantasia: toNullableString(row.nome_fantasia),
        codigoPrd: toNullableString(row.codigo_prd),
        idPrd: toNullableString(row.id_prd),
        numNoFabric: toNullableString(row.num_no_fabric),
        codUnd: toNullableString(row.cod_und),
        nseqItmMov: toNullableString(row.nseq_itm_mov),
        idNat: toNullableString(row.id_nat),
        codNat: toNullableString(row.cod_nat),
        descNat: toNullableString(row.desc_nat),
        codColTborcamento: toNullableString(row.cod_col_tborcamento),
        codTborcamento: toNullableString(row.cod_tborcamento),
        descTborcamento: toNullableString(row.desc_tborcamento),
        idMovOc: toNullableString(row.id_mov_oc),
        nseqItmMovOc: toNullableString(row.nseq_itm_mov_oc),
        quantidade: toNullableNumber(row.quantidade),
        precoUnitario: toNullableNumber(row.preco_unitario),
        valorBrutoItem: toNullableNumber(row.valor_bruto_item),
        valorTotalItem: toNullableNumber(row.valor_total_item),
        valorLiquido: toNullableNumber(row.valor_liquido),
      })),
      apportionments: (recordsets[3] ?? []).map((row): EntryApportionment => ({
        lineNumber: Number(row.line_number),
        seqF: toNullableString(row.seq_f),
        itemSeqF: toNullableString(row.item_seq_f),
        nseqItmMov: toNullableString(row.nseq_itm_mov),
        descCusto: toNullableString(row.desc_custo),
        codCcusto: toNullableString(row.cod_ccusto),
        valor: toNullableNumber(row.valor),
      })),
      taxes: (recordsets[4] ?? []).map((row): EntryTax => ({
        lineNumber: Number(row.line_number),
        seqF: toNullableString(row.seq_f),
        itemSeqF: toNullableString(row.item_seq_f),
        nseqItmMov: toNullableString(row.nseq_itm_mov),
        codTrb: toNullableString(row.cod_trb),
        sitTributaria: toNullableString(row.sit_tributaria),
        baseDeCalculo: toNullableNumber(row.base_de_calculo),
        aliquota: toNullableNumber(row.aliquota),
        tipoRecolhimento: toNullableString(row.tipo_recolhimento),
        valor: toNullableNumber(row.valor),
      })),
      payments: (recordsets[5] ?? []).map((row): EntryPayment => ({
        lineNumber: Number(row.line_number),
        seqF: toNullableString(row.seq_f),
        codColigada: toNullableString(row.cod_coligada),
        idMov: toNullableString(row.id_mov),
        idSeqPagto: toNullableString(row.id_seq_pagto),
        dataVencimento: mapDateValue(row.data_vencimento),
        valor: toNullableNumber(row.valor),
        descFormaPagto: toNullableString(row.desc_forma_pagto),
        idFormaPagto: toNullableString(row.id_forma_pagto),
        tipoFormaPagto: toNullableString(row.tipo_forma_pagto),
        codColCxa: toNullableString(row.cod_col_cxa),
        descCodCxa: toNullableString(row.desc_cod_cxa),
        codCxa: toNullableString(row.cod_cxa),
        tipoPagamento: toNullableString(row.tipo_pagamento),
        debitoCredito: toNullableString(row.debito_credito),
        taxaAdm: toNullableNumber(row.taxa_adm),
        idLan: toNullableString(row.id_lan),
        adtIntegrado: toNullableString(row.adt_integrado),
        linhaDigitavel: toNullableString(row.linha_digitavel),
      })),
    };
  }

  public async createEntry(payload: EntryRecordInput): Promise<EntryRecord> {
    const now = new Date().toISOString();
    let entry = mapRecordFromInput(randomUUID(), payload, now, now);
    if (entry.mode === 'submit') {
      entry = await this.applyAutomaticItemIdentifiers(entry);
    }
    validateEntryRecord(entry, entry.mode);
    await this.ensureDuplicate(entry);
    await ensureDatabaseStructure();
    await this.persistEntry(entry, false);
    return this.getEntryById(entry.id);
  }

  public async updateEntry(entryId: string, payload: EntryRecordInput): Promise<EntryRecord> {
    const existing = await this.getEntryById(entryId);
    if (existing.status === 'approved') {
      throw new AppError(
        409,
        'Notas ja aprovadas nao podem ser alteradas.',
        'ENTRY_ALREADY_APPROVED'
      );
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
    validateEntryRecord(entry, entry.mode);
    await this.ensureDuplicate(entry, entryId);
    await this.persistEntry(entry, true);
    return this.getEntryById(entryId);
  }

  public async submitEntry(entryId: string, payload?: EntryRecordInput): Promise<EntryRecord> {
    const sourceRecord = payload
      ? await this.updateEntry(entryId, { ...payload, mode: 'submit' })
      : await this.getEntryById(entryId);

    if (sourceRecord.status === 'approved') {
      throw new AppError(
        409,
        'Esta nota ja foi aprovada e integrada ao RM.',
        'ENTRY_ALREADY_APPROVED'
      );
    }

    let recordToSubmit: EntryRecord = {
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
    validateEntryRecord(recordToSubmit, 'submit');
    await this.ensureDuplicate(recordToSubmit, entryId);
    await this.persistEntry(recordToSubmit, true);
    return this.getEntryById(entryId);
  }

  public async approveEntry(entryId: string, review: EntryReviewInput): Promise<EntryRecord> {
    const sourceRecord = await this.getEntryById(entryId);

    if (!['pending_analysis', 'submitted'].includes(sourceRecord.status)) {
      throw new AppError(
        409,
        'Somente notas pendentes de analise podem ser aprovadas.',
        'ENTRY_REVIEW_INVALID_STATUS'
      );
    }

    try {
      const recordToApprove = await this.applyAutomaticItemIdentifiers(sourceRecord);

      if (recordToApprove !== sourceRecord) {
        await this.persistEntry(recordToApprove, true);
      }

      const integrationResult = await this.rmEntryInvoiceMovementService.integrate(recordToApprove);
      const reviewedBy = toNullableString(review.reviewedBy) ?? sourceRecord.updatedBy;
      const reviewedComment = toNullableString(review.comment);
      const approvedRecord: EntryRecord = {
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida na integracao RM.';
      const details: Record<string, string> = { message };

      if (message.includes('Número Identificador inválido') || message.includes('Numero Identificador invalido')) {
        details.hint =
          'O produto exige Numero Identificador no item. A API tentou inferir esse valor automaticamente a partir da O.C.; se ainda assim falhou, revise o cadastro ou o identificador do produto no RM.';
      }

      await this.updateReviewMetadata(entryId, {
        reviewComment: toNullableString(review.comment),
        rmIntegrationStatus: 'error',
        rmIntegrationMessage: message,
        updatedBy: toNullableString(review.reviewedBy) ?? sourceRecord.updatedBy,
      });
      throw new AppError(
        502,
        'Nao foi possivel integrar a nota no RM durante a aprovacao.',
        'ENTRY_RM_INTEGRATION_ERROR',
        details
      );
    }
  }

  public async rejectEntry(entryId: string, review: EntryReviewInput): Promise<EntryRecord> {
    const sourceRecord = await this.getEntryById(entryId);

    if (!['pending_analysis', 'submitted'].includes(sourceRecord.status)) {
      throw new AppError(
        409,
        'Somente notas pendentes de analise podem ser reprovadas.',
        'ENTRY_REVIEW_INVALID_STATUS'
      );
    }

    const reviewedBy = toNullableString(review.reviewedBy) ?? sourceRecord.updatedBy;
    const rejectedRecord: EntryRecord = {
      ...sourceRecord,
      status: 'rejected',
      reviewComment: toNullableString(review.comment),
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

  private async applyAutomaticItemIdentifiers(entry: EntryRecord): Promise<EntryRecord> {
    const codColigada = toNullableString(entry.header.codColigada);
    if (!codColigada) {
      return entry;
    }

    const itemsToResolve = entry.items.filter(
      (item) =>
        !hasValue(item.numNoFabric) &&
        hasValue(item.idMovOc) &&
        hasValue(item.nseqItmMovOc)
    );

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

      const identifierByItemKey = new Map<string, string>();
      for (const row of lookupRows) {
        const idMovOc = toNullableString(row.TITMMOV_T_IDMOV);
        const nseqItmMovOc = toNullableString(row.TITMMOV_T_NSEQITMMOV);
        const inferredIdentifier =
          toNullableString(row.TITMMOV_T_NUMNOFABRIC) ??
          toNullableString(row.TITMMOV_T_CODNOFORN);

        if (!idMovOc || !nseqItmMovOc || !inferredIdentifier) {
          continue;
        }

        identifierByItemKey.set(`${idMovOc}_${nseqItmMovOc}`, inferredIdentifier);
      }

      let changed = false;
      const items = entry.items.map((item) => {
        if (hasValue(item.numNoFabric) || !item.idMovOc || !item.nseqItmMovOc) {
          return item;
        }

        const inferredIdentifier = identifierByItemKey.get(
          `${String(item.idMovOc).trim()}_${String(item.nseqItmMovOc).trim()}`
        );

        if (!inferredIdentifier) {
          return item;
        }

        changed = true;
        return {
          ...item,
          numNoFabric: inferredIdentifier,
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
    } catch {
      return entry;
    }
  }

  public async deleteEntry(entryId: string): Promise<void> {
    await ensureDatabaseStructure();
    const pool = await getPool();
    const request = pool.request();

    request.input('entryId', entryId);

    const result = await request.query(`
      UPDATE ${tableName('entries')}
      SET deleted_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
      WHERE id = @entryId
        AND deleted_at IS NULL;

      SELECT @@ROWCOUNT AS affectedRows;
    `);
    const recordsets = result.recordsets as DbRow[][];

    const affectedRows = Number(recordsets?.[0]?.[0]?.affectedRows ?? 0);
    if (!affectedRows) {
      throw new AppError(404, 'Registro de Entrada de Nota Fiscal nao encontrado.', 'ENTRY_NOT_FOUND');
    }
  }

  private async ensureDuplicate(entry: EntryRecord, excludeId?: string): Promise<void> {
    if (
      !hasValue(entry.header.codColigada) ||
      !hasValue(entry.header.codFilial) ||
      !hasValue(entry.header.codColCfo) ||
      !hasValue(entry.header.codCfo) ||
      !hasValue(entry.header.numeroMov) ||
      !hasValue(entry.header.serie)
    ) {
      return;
    }

    await ensureDatabaseStructure();
    const pool = await getPool();
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
      throw new AppError(
        409,
        'Ja existe uma Entrada de Nota Fiscal cadastrada para essa combinacao de fornecedor, filial, numero e serie.',
        'ENTRY_DUPLICATED'
      );
    }
  }

  private async updateReviewMetadata(
    entryId: string,
    metadata: {
      reviewComment?: string | null;
      rmIntegrationStatus?: string | null;
      rmIntegrationMessage?: string | null;
      updatedBy?: string | null;
    }
  ): Promise<void> {
    await ensureDatabaseStructure();
    const pool = await getPool();
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

  private async persistEntry(entry: EntryRecord, isUpdate: boolean): Promise<void> {
    await ensureDatabaseStructure();
    const pool = await getPool();
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
      request.input(
        'payloadJson',
        JSON.stringify({
          mode: entry.mode,
          requestedBy: entry.requestedBy,
        })
      );
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
      } else {
        await request.query(`
          INSERT INTO ${tableName('entries')} (
            id, status, numero_mov, serie, cod_coligada, cod_filial, filial_description,
            cod_col_cfo, cod_cfo, fornecedor_description, cnpj_cpf, data_emissao, data_saida,
            local_estoque_description, cod_loc, cod_tmv, cod_tdo, movimento_description, serie_nf, id_nat, cod_nat, natureza_description,
            qualidade, prazo, atendimento, valor_bruto, valor_liquido, valor_frete, valor_desc,
            valor_desp, valor_outros, chave_acesso_nfe, gerar_frap, data_prev_baixa, historico,
            observacao_avaliacao, financeiro, possui_adiantamento, cod_cpg, descricao_cod_cpg,
            cod_cxa, descricao_cod_cxa, payload_json, created_by, updated_by, review_comment,
            approved_by, approved_at, rejected_by, rejected_at, rm_movement_id, rm_primary_key,
            rm_integration_status, rm_integration_message
          ) VALUES (
            @id, @status, @numeroMov, @serie, @codColigada, @codFilial, @filialDescription,
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

      await this.insertCollection(
        transaction,
        'purchase_orders',
        entry.id,
        entry.purchaseOrders.map((row) => ({
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
        }))
      );
      await this.insertCollection(
        transaction,
        'items',
        entry.id,
        entry.items.map((row) => ({
          line_number: row.lineNumber,
          seq_f: row.seqF,
          nome_fantasia: row.nomeFantasia,
          codigo_prd: row.codigoPrd,
          id_prd: row.idPrd,
          num_no_fabric: row.numNoFabric,
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
        }))
      );
      await this.insertCollection(
        transaction,
        'apportionments',
        entry.id,
        entry.apportionments.map((row) => ({
          line_number: row.lineNumber,
          seq_f: row.seqF,
          item_seq_f: row.itemSeqF,
          nseq_itm_mov: row.nseqItmMov,
          desc_custo: row.descCusto,
          cod_ccusto: row.codCcusto,
          valor: row.valor,
        }))
      );
      await this.insertCollection(
        transaction,
        'taxes',
        entry.id,
        entry.taxes.map((row) => ({
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
        }))
      );
      await this.insertCollection(
        transaction,
        'payments',
        entry.id,
        entry.payments.map((row) => ({
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
        }))
      );

      await transaction.commit();
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {
        // ignore rollback error
      }
      throw error;
    }
  }

  private async insertCollection(
    transaction: sql.Transaction,
    tableSuffix: string,
    entryId: string,
    rows: RowMap[]
  ): Promise<void> {
    const table = tableName(tableSuffix);

    for (const row of rows) {
      const request = transaction.request();
      request.input('id', randomUUID());
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
