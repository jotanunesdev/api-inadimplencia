import { AppError } from '../types/errors';
import { RmGatewayError, ValidationError } from '../../rm/types/Rm';
import { RmEntryInvoiceLookupService } from '../../rm/services/RmEntryInvoiceLookupService';

type LookupQuery = Record<string, string | undefined>;
type LookupRow = Record<string, unknown>;

const rmLookupService = new RmEntryInvoiceLookupService();

function normalizeLookupError(error: unknown): never {
  if (error instanceof ValidationError) {
    throw new AppError(400, error.message, 'ENTRY_LOOKUP_VALIDATION_ERROR');
  }

  if (error instanceof RmGatewayError) {
    throw new AppError(502, error.details, 'ENTRY_LOOKUP_RM_GATEWAY_ERROR');
  }

  if (error instanceof AppError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new AppError(500, error.message, 'ENTRY_LOOKUP_INTERNAL_ERROR');
  }

  throw new AppError(
    500,
    'Falha inesperada ao consultar os lookups da entrada de nota fiscal.',
    'ENTRY_LOOKUP_INTERNAL_ERROR'
  );
}

export class EntryInvoiceLookupService {
  public async getFiliais(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getFiliais(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getFornecedores(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getFornecedores(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getMovimentos(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getMovimentos(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getParamMovimento(query: LookupQuery): Promise<LookupRow | null> {
    try {
      return await rmLookupService.getParamMovimento(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getSeries(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getSeries(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getLocaisEstoque(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getLocaisEstoque(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getNaturezasFiscais(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getNaturezasFiscais(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getCondicoesPagamento(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getCondicoesPagamento(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getParcelamento(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getParcelamento(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getEstados(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getEstados(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getMunicipios(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getMunicipios(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getCentrosCusto(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getCentrosCusto(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getFormasPagamento(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getFormasPagamentoResumo(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getTaxRates(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getTaxRates(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getPurchaseOrders(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getPurchaseOrders(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getPurchaseOrderItems(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getPurchaseOrderItems(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }

  public async getPurchaseOrderApportionments(query: LookupQuery): Promise<LookupRow[]> {
    try {
      return await rmLookupService.getPurchaseOrderApportionments(query);
    } catch (error) {
      normalizeLookupError(error);
    }
  }
}
