import { Router } from 'express';
import { env } from '../config/env';
import { RmDataServerClient } from '../clients/RmDataServerClient';
import { RmController } from '../controllers/RmController';
import { createRmRoutes } from './rm.routes';
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

const router = Router();

router.use(createRmRoutes(controller));

export default router;
