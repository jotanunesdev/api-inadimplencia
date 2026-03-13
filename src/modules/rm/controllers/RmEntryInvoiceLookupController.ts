import type { NextFunction, Request, Response } from 'express';
import { RmGatewayError, ValidationError } from '../types/Rm';
import { LookupQuery } from '../services/entryInvoiceLookupDefinitions';
import { RmEntryInvoiceLookupService } from '../services/RmEntryInvoiceLookupService';

function normalizeQuery(query: Request['query']): LookupQuery {
  return Object.entries(query).reduce<LookupQuery>((accumulator, [key, value]) => {
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

export class RmEntryInvoiceLookupController {
  constructor(private readonly service: RmEntryInvoiceLookupService) {}

  private respond =
    <T>(fn: (query: LookupQuery) => Promise<T>) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const data = await fn(normalizeQuery(req.query));
        res.status(200).json({
          success: true,
          data,
        });
      } catch (error: unknown) {
        if (error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: {
              code: 'RM_LOOKUP_VALIDATION_ERROR',
              message: error.message,
            },
          });
          return;
        }

        if (error instanceof RmGatewayError) {
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

  public coligadas = this.respond((query) => this.service.getColigadas(query));
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
  public formasPagamentoResumo = this.respond((query) => this.service.getFormasPagamentoResumo(query));
  public contasCaixa = this.respond((query) => this.service.getContasCaixa(query));
  public purchaseOrders = this.respond((query) => this.service.getPurchaseOrders(query));
  public purchaseOrderItems = this.respond((query) => this.service.getPurchaseOrderItems(query));
  public purchaseOrderApportionments = this.respond((query) =>
    this.service.getPurchaseOrderApportionments(query)
  );
  public purchaseOrderApportionmentByItem = this.respond((query) =>
    this.service.getPurchaseOrderApportionmentByItem(query)
  );
  public taxes = this.respond((query) => this.service.getTaxes(query));
  public taxRates = this.respond((query) => this.service.getTaxRates(query));
  public lancamentosFinanceiros = this.respond((query) =>
    this.service.getLancamentosFinanceiros(query)
  );
  public detalhesTipoPagamento = this.respond((query) =>
    this.service.getDetalhesTipoPagamento(query)
  );
}
