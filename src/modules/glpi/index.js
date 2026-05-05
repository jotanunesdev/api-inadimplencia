const express = require('express');
const cors = require('cors');
const { createCorsOptionsDelegate, isRequestAllowed } = require('../../shared/swaggerAccess');
const { env } = require('./config/env');
const routes = require('./routes');
const openapi = require('./docs/openapi');
const { notFound } = require('./middlewares/notFound');
const { errorHandler } = require('./middlewares/errorHandler');

function createGlpiModule(dependencies = {}) {
  const moduleEnv = dependencies.env ?? env;
  const router = express.Router();
  const corsOptions = createCorsOptionsDelegate(moduleEnv);

  router.use(cors(corsOptions));
  router.options('*', cors(corsOptions));
  router.use((req, res, next) => {
    if (isRequestAllowed(req, moduleEnv)) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Origem nao permitida.',
      code: 'FORBIDDEN_ORIGIN',
    });
  });

  router.use('/', routes);
  router.use(notFound);
  router.use(errorHandler);

  return {
    router,
    openapi,
  };
}

module.exports = {
  createGlpiModule,
};
