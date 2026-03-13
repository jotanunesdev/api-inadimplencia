import { RmGatewayError, ValidationError } from '../types/Rm';
import {
  DEFAULT_LIMIT,
  DEFAULT_SEARCH,
  DEFAULT_SEPARATOR,
  ENTRY_INVOICE_LOOKUPS,
  LookupDefinition,
  LookupQuery,
  LookupRow,
} from './entryInvoiceLookupDefinitions';

const { buildConstraint, fetchDataset } = require('../../../shared/fluigDataset.js') as {
  buildConstraint: (
    field: string,
    initialValue: string | number,
    finalValue?: string | number,
    type?: number
  ) => Record<string, string | number>;
  fetchDataset: (
    name: string,
    options?: {
      constraints?: Array<Record<string, string | number>>;
      envPrefix?: string;
    }
  ) => Promise<Record<string, unknown>>;
};

const DATASET_NAME = 'dsIntegraFacilRM';
const DATASET_ENV_PREFIX = 'RM';

function toLookupRows(dataset: Record<string, unknown>): LookupRow[] {
  const values =
    (dataset.values as LookupRow[] | undefined) ??
    (dataset.content as LookupRow[] | undefined) ??
    [];

  if (!Array.isArray(values)) {
    return [];
  }

  return values;
}

function readDatasetError(rows: LookupRow[]): string | null {
  const firstRow = rows[0];
  if (!firstRow) {
    return null;
  }

  const error = firstRow.ERRO ?? firstRow.erro;
  return error ? String(error) : null;
}

function sanitizeParameterValue(key: string, value: string | undefined): string {
  if (key === 'LIMITEFLUIG') {
    return value && value.trim() ? value.trim() : DEFAULT_LIMIT;
  }

  if (key === 'BUSCADOR') {
    return value && value.trim() ? value.trim() : DEFAULT_SEARCH;
  }

  if (key === 'SEPARADOR') {
    return value && value.trim() ? value.trim() : DEFAULT_SEPARATOR;
  }

  if (key === 'SEPARADORLIST') {
    return value && value.trim() ? value.trim() : '_';
  }

  return String(value ?? '').trim();
}

function buildParameterString(definition: LookupDefinition, query: LookupQuery): string {
  return definition.parameterKeys
    .map((key) => `${key}=${sanitizeParameterValue(key, query[key])}`)
    .join('|');
}

function splitList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class RmEntryInvoiceLookupService {
  private async executeLookup(definition: LookupDefinition, query: LookupQuery): Promise<LookupRow[]> {
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
        throw new RmGatewayError(error);
      }

      return rows;
    } catch (error: unknown) {
      if (error instanceof ValidationError || error instanceof RmGatewayError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new RmGatewayError(error.message);
      }

      throw new RmGatewayError('Falha inesperada ao consultar lookup da entrada de nota fiscal.');
    }
  }

  public getColigadas(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.coligada, query);
  }

  public getFiliais(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.filial, query);
  }

  public getFornecedores(query: LookupQuery): Promise<LookupRow[]> {
    const definition = query.BASECNPJ
      ? ENTRY_INVOICE_LOOKUPS.fornecedorBaseCnpj
      : ENTRY_INVOICE_LOOKUPS.fornecedor;

    return this.executeLookup(definition, query);
  }

  public getMovimentos(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.movimento, query);
  }

  public async getParamMovimento(query: LookupQuery): Promise<LookupRow | null> {
    const rows = await this.executeLookup(ENTRY_INVOICE_LOOKUPS.paramMovimento, query);
    return rows[0] ?? null;
  }

  public getSeries(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.serie, query);
  }

  public getLocaisEstoque(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.localEstoque, query);
  }

  public getNaturezasFiscais(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.naturezaFiscal, query);
  }

  public getCondicoesPagamento(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.condicaoPagto, query);
  }

  public getParcelamento(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.parcelamento, query);
  }

  public getEstados(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.estado, query);
  }

  public getMunicipios(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.municipio, query);
  }

  public getCentrosCusto(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.centroCusto, query);
  }

  public getFormasPagamento(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.formaPagto, query);
  }

  public getFormasPagamentoResumo(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.formaPagtoResumo, query);
  }

  public getContasCaixa(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.codCxa, query);
  }

  public getPurchaseOrders(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.purchaseOrder, query);
  }

  public getPurchaseOrderItems(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.purchaseOrderItems, query);
  }

  public async getPurchaseOrderApportionments(query: LookupQuery): Promise<LookupRow[]> {
    const codColigada = String(query.CODCOLIGADA ?? '').trim();
    const ids = splitList(query.LISTIDMOV);

    if (!codColigada) {
      throw new ValidationError('Parametro "CODCOLIGADA" e obrigatorio');
    }

    if (ids.length === 0) {
      return [];
    }

    const rows = await Promise.all(
      ids.map((idMov) =>
        this.executeLookup(ENTRY_INVOICE_LOOKUPS.purchaseOrderApport, {
          CODCOLIGADA: codColigada,
          IDMOV: idMov,
        })
      )
    );

    return rows.flat();
  }

  public getPurchaseOrderApportionmentByItem(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.purchaseOrderApportEspecific, query);
  }

  public getTaxes(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.taxes, query);
  }

  public getTaxRates(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.taxesAliquotas, query);
  }

  public getLancamentosFinanceiros(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.lancamentosFinanceiros, query);
  }

  public getDetalhesTipoPagamento(query: LookupQuery): Promise<LookupRow[]> {
    return this.executeLookup(ENTRY_INVOICE_LOOKUPS.detalhesTipoPagamento, query);
  }
}
