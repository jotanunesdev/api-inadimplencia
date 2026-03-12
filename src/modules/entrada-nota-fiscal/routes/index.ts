import { Router } from 'express';
import { EntryInvoiceController } from '../controllers/entryInvoiceController';
import { EntryInvoiceService } from '../services/entryInvoiceService';

const router = Router();
const controller = new EntryInvoiceController(new EntryInvoiceService());

router.get('/metadata', controller.metadata);
router.get('/entries', controller.list);
router.get('/entries/:entryId', controller.getById);
router.post('/entries', controller.create);
router.put('/entries/:entryId', controller.update);
router.post('/entries/:entryId/submit', controller.submit);
router.delete('/entries/:entryId', controller.remove);

export default router;
