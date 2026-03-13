import { Router } from 'express';
import { env } from '../config/env';
import { RmDataServerClient } from '../clients/RmDataServerClient';
import { RmEntryInvoiceLookupController } from '../controllers/RmEntryInvoiceLookupController';
import { RmController } from '../controllers/RmController';
import { createRmEntryInvoiceLookupRoutes } from './entryInvoiceLookup.routes';
import { createRmRoutes } from './rm.routes';
import { RmEntryInvoiceLookupService } from '../services/RmEntryInvoiceLookupService';
import { RmService } from '../services/RmService';

const controller = new RmController(
  new RmService(
    new RmDataServerClient({
      dbTrustCert: env.DB_TRUST_CERT,
      readViewUrl: env.READVIEW_URL,
      readViewUser: env.READVIEW_USER,
      readViewPassword: env.READVIEW_PASSWORD,
      readViewAction: env.READVIEW_ACTION,
      readViewNamespace: env.READVIEW_NAMESPACE,
      getSchemaAction: env.GETSCHEMA_ACTION,
      readRecordAction: env.READRECORD_ACTION,
      saveRecordAction: env.SAVERECORD_ACTION,
    })
  )
);
const entryInvoiceLookupController = new RmEntryInvoiceLookupController(
  new RmEntryInvoiceLookupService()
);

const router = Router();

router.use(createRmRoutes(controller));
router.use(
  '/entrada-nota-fiscal/lookups',
  createRmEntryInvoiceLookupRoutes(entryInvoiceLookupController)
);

export default router;
