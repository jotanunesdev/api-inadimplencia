const express = require('express');
const path = require('path');
const { pathToFileURL } = require('url');

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

async function createTreinamentoModule() {
  const [
    routesModule,
    openapiModule,
    envModule,
    notFoundModule,
    errorHandlerModule,
  ] = await Promise.all([
    importTsFile('routes/index.ts'),
    importTsFile('docs/openapi.ts'),
    importTsFile('config/env.ts'),
    importTsFile('middlewares/notFound.ts'),
    importTsFile('middlewares/errorHandler.ts'),
  ]);

  const routes = unwrapDefaultExport(routesModule);
  const openapi = unwrapDefaultExport(openapiModule);
  const envExports = unwrapDefaultExport(envModule);
  const notFoundExports = unwrapDefaultExport(notFoundModule);
  const errorHandlerExports = unwrapDefaultExport(errorHandlerModule);

  const env = envExports.env ?? envExports;
  const notFound = notFoundExports.notFound ?? notFoundExports;
  const errorHandler = errorHandlerExports.errorHandler ?? errorHandlerExports;

  const router = express.Router();

  router.use('/', routes);
  router.use(express.static(path.resolve(env.PUBLIC_ASSETS_ROOT)));
  router.use(notFound);
  router.use(errorHandler);

  return {
    router,
    openapi,
  };
}

module.exports = {
  createTreinamentoModule,
};
