import type { NextFunction, Request, Response } from 'express';
import { EntryInvoiceLookupService } from '../services/entryInvoiceLookupService';

function normalizeQuery(query: Request['query']): Record<string, string | undefined> {
  return Object.entries(query).reduce<Record<string, string | undefined>>((accumulator, [key, value]) => {
    if (typeof value === 'string') {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
}

export class EntryInvoiceLookupController {
  constructor(private readonly service: EntryInvoiceLookupService) {}

  private respond =
    <T>(fn: (query: Record<string, string | undefined>) => Promise<T>) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const data = await fn(normalizeQuery(req.query));
        res.status(200).json({
          success: true,
          data,
        });
      } catch (error) {
        next(error);
      }
    };

  public filiais = this.respond((query) => this.service.getFiliais(query));
  public fornecedores = this.respond((query) => this.service.getFornecedores(query));
  public movimentos = this.respond((query) => this.service.getMovimentos(query));
  public paramMovimento = this.respond((query) => this.service.getParamMovimento(query));
  public series = this.respond((query) => this.service.getSeries(query));
  public locaisEstoque = this.respond((query) => this.service.getLocaisEstoque(query));
  public naturezasFiscais = this.respond((query) => this.service.getNaturezasFiscais(query));
  public condicoesPagamento = this.respond((query) => this.service.getCondicoesPagamento(query));
  public parcelamento = this.respond((query) => this.service.getParcelamento(query));
  public estados = this.respond((query) => this.service.getEstados(query));
  public municipios = this.respond((query) => this.service.getMunicipios(query));
  public centrosCusto = this.respond((query) => this.service.getCentrosCusto(query));
  public formasPagamento = this.respond((query) => this.service.getFormasPagamento(query));
  public taxRates = this.respond((query) => this.service.getTaxRates(query));
  public purchaseOrders = this.respond((query) => this.service.getPurchaseOrders(query));
  public purchaseOrderItems = this.respond((query) => this.service.getPurchaseOrderItems(query));
  public purchaseOrderApportionments = this.respond((query) =>
    this.service.getPurchaseOrderApportionments(query)
  );
}
