import { Router } from 'express';
import { RmEntryInvoiceLookupController } from '../controllers/RmEntryInvoiceLookupController';

export const createRmEntryInvoiceLookupRoutes = (
  controller: RmEntryInvoiceLookupController
): Router => {
  const router = Router();

  router.get('/coligadas', controller.coligadas);
  router.get('/filiais', controller.filiais);
  router.get('/fornecedores', controller.fornecedores);
  router.get('/movimentos', controller.movimentos);
  router.get('/param-movimento', controller.paramMovimento);
  router.get('/series', controller.series);
  router.get('/locais-estoque', controller.locaisEstoque);
  router.get('/naturezas-fiscais', controller.naturezasFiscais);
  router.get('/condicoes-pagamento', controller.condicoesPagamento);
  router.get('/parcelamento', controller.parcelamento);
  router.get('/estados', controller.estados);
  router.get('/municipios', controller.municipios);
  router.get('/centros-custo', controller.centrosCusto);
  router.get('/formas-pagamento', controller.formasPagamento);
  router.get('/formas-pagamento-resumo', controller.formasPagamentoResumo);
  router.get('/contas-caixa', controller.contasCaixa);
  router.get('/purchase-orders', controller.purchaseOrders);
  router.get('/purchase-order-items', controller.purchaseOrderItems);
  router.get('/purchase-order-apportionments', controller.purchaseOrderApportionments);
  router.get(
    '/purchase-order-apportionments/item',
    controller.purchaseOrderApportionmentByItem
  );
  router.get('/taxes', controller.taxes);
  router.get('/tax-rates', controller.taxRates);
  router.get('/lancamentos-financeiros', controller.lancamentosFinanceiros);
  router.get('/detalhes-tipo-pagamento', controller.detalhesTipoPagamento);

  return router;
};
