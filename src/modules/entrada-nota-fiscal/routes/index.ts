import { Router } from 'express';
import { EntryInvoiceController } from '../controllers/entryInvoiceController';
import { EntryInvoiceLookupController } from '../controllers/entryInvoiceLookupController';
import { EntryInvoiceService } from '../services/entryInvoiceService';
import { EntryInvoiceLookupService } from '../services/entryInvoiceLookupService';

const router = Router();
const controller = new EntryInvoiceController(new EntryInvoiceService());
const lookupController = new EntryInvoiceLookupController(new EntryInvoiceLookupService());

router.get('/metadata', controller.metadata);
router.get('/lookups/filiais', lookupController.filiais);
router.get('/lookups/fornecedores', lookupController.fornecedores);
router.get('/lookups/movimentos', lookupController.movimentos);
router.get('/lookups/param-movimento', lookupController.paramMovimento);
router.get('/lookups/series', lookupController.series);
router.get('/lookups/locais-estoque', lookupController.locaisEstoque);
router.get('/lookups/naturezas-fiscais', lookupController.naturezasFiscais);
router.get('/lookups/condicoes-pagamento', lookupController.condicoesPagamento);
router.get('/lookups/parcelamento', lookupController.parcelamento);
router.get('/lookups/centros-custo', lookupController.centrosCusto);
router.get('/lookups/formas-pagamento', lookupController.formasPagamento);
router.get('/lookups/tax-rates', lookupController.taxRates);
router.get('/lookups/purchase-orders', lookupController.purchaseOrders);
router.get('/lookups/purchase-order-items', lookupController.purchaseOrderItems);
router.get(
  '/lookups/purchase-order-apportionments',
  lookupController.purchaseOrderApportionments
);
router.get('/entries', controller.list);
router.get('/entries/:entryId', controller.getById);
router.post('/entries', controller.create);
router.put('/entries/:entryId', controller.update);
router.post('/entries/:entryId/submit', controller.submit);
router.delete('/entries/:entryId', controller.remove);

export default router;
