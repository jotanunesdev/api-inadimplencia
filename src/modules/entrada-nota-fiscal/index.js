const express = require('express');
const path = require('path');
const { pathToFileURL } = require('url');
const cors = require('cors');
const { createCorsOptionsDelegate, isRequestAllowed } = require('../../shared/swaggerAccess');

function importTsFile(relativePath) {
  const absolutePath = path.join(__dirname, relativePath);
  return import(pathToFileURL(absolutePath).href);
}

function unwrapDefaultExport(moduleValue) {
  let current = moduleValue;

  if (current && typeof current === 'object' && 'default' in current) {
    current = current.default;
  }

  while (
    current &&
    typeof current === 'object' &&
    'default' in current &&
    Object.keys(current).length === 1
  ) {
    current = current.default;
  }

  return current;
}

async function createEntradaNotaFiscalModule() {
  const [routesModule, openapiModule, envModule, notFoundModule, errorHandlerModule, schemaModule] =
    await Promise.all([
      importTsFile('routes/index.ts'),
      importTsFile('docs/openapi.ts'),
      importTsFile('config/env.ts'),
      importTsFile('middlewares/notFound.ts'),
      importTsFile('middlewares/errorHandler.ts'),
      importTsFile('services/schemaService.ts'),
    ]);

  const routes = unwrapDefaultExport(routesModule);
  const openapi = unwrapDefaultExport(openapiModule);
  const envExports = unwrapDefaultExport(envModule);
  const notFoundExports = unwrapDefaultExport(notFoundModule);
  const errorHandlerExports = unwrapDefaultExport(errorHandlerModule);
  const schemaExports = unwrapDefaultExport(schemaModule);

  const env = envExports.env ?? envExports;
  const notFound = notFoundExports.notFound ?? notFoundExports;
  const errorHandler = errorHandlerExports.errorHandler ?? errorHandlerExports;
  const ensureDatabaseStructure = schemaExports.ensureDatabaseStructure;
  const getInitializationState = schemaExports.getInitializationState;

  if (env.isConfigured && typeof ensureDatabaseStructure === 'function') {
    await ensureDatabaseStructure().catch(() => {
      // health endpoint exposes initialization state
    });
  }

  const router = express.Router();
  const corsOptions = createCorsOptionsDelegate(env);

  router.use(cors(corsOptions));
  router.options('*', cors(corsOptions));
  router.use((req, res, next) => {
    if (isRequestAllowed(req, env)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN_ORIGIN',
        message: 'Origem nao permitida.',
      },
    });
  });

  router.get('/health', (_req, res) => {
    const initializationState =
      typeof getInitializationState === 'function'
        ? getInitializationState()
        : { ready: false, initializing: false, lastError: null };
    const isHealthy = env.isConfigured && (initializationState.ready || !initializationState.lastError);

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'degraded',
      module: 'entrada-nota-fiscal',
      configured: env.isConfigured,
      missingRequired: env.missingRequired,
      initialization: initializationState,
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
  createEntradaNotaFiscalModule,
};
