const cors = require('cors');
const { Router } = require('express');
const pm2Routes = require('./routes/pm2Routes');
const openapi = require('./swagger');
const { env } = require('./config/env');
const { attachRealtimeServer } = require('./services/pm2Service');
const { createCorsOptionsDelegate, isRequestAllowed } = require('../../shared/swaggerAccess');

function createPm2Module() {
  const router = Router();
  const corsOptions = createCorsOptionsDelegate(env);

  router.use(cors(corsOptions));
  router.options('*', cors(corsOptions));
  router.use((req, res, next) => {
    if (isRequestAllowed(req, env)) {
      next();
      return;
    }

    res.status(403).json({ error: 'Origem nao permitida.' });
  });

  router.use('/', pm2Routes);

  router.use((_, res) => {
    res.status(404).json({ error: 'Endpoint nao encontrado' });
  });

  return {
    router,
    openapi,
    attachRealtimeServer,
  };
}

module.exports = {
  createPm2Module,
};
