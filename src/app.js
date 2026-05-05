const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { createInadimplenciaModule } = require('./modules/inadimplencia');
const { createTreinamentoModule } = require('./modules/treinamento');
const { createFluigModule } = require('./modules/fluig');
const { createPm2Module } = require('./modules/pm2');
const { createM365Module } = require('./modules/m365');
const { createEstoqueOnlineModule } = require('./modules/estoque-online');
const { createGlpiModule } = require('./modules/glpi');
const { createAuthModule } = require('./modules/auth');
const { createRmModule } = require('./modules/rm');
const { createEntradaNotaFiscalModule } = require('./modules/entrada-nota-fiscal');
const {
  buildUnifiedOpenapi,
  buildInadimplenciaOpenapi,
  buildTreinamentoOpenapi,
  buildFluigOpenapi,
  buildPm2Openapi,
  buildM365Openapi,
  buildEstoqueOnlineOpenapi,
  buildGlpiOpenapi,
  buildAuthOpenapi,
  buildRmOpenapi,
  buildEntradaNotaFiscalOpenapi,
} = require('./docs/unifiedOpenapi');
const { createCorsOptionsDelegate } = require('./shared/swaggerAccess');

function buildRootCorsEnv() {
  const corsOrigin = String(process.env.CORS_ORIGIN ?? '*');
  const corsOrigins = corsOrigin
    .split(',')
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean);

  return {
    CORS_ORIGIN: corsOrigin,
    CORS_ORIGINS: corsOrigins,
    CORS_ALLOW_ALL: corsOrigins.includes('*'),
  };
}

async function resolveModule(factory, override) {
  if (override !== undefined) {
    return Promise.resolve(typeof override === 'function' ? override() : override);
  }

  return Promise.resolve(factory());
}

async function createApp(dependencies = {}) {
  const app = express();
  const rootCorsEnv = buildRootCorsEnv();
  const rootCorsOptions = createCorsOptionsDelegate(rootCorsEnv);

  app.use(cors(rootCorsOptions));
  app.options('*', cors(rootCorsOptions));

  app.use(express.json({ limit: '10mb' }));

  const inadimplenciaModule = await resolveModule(
    createInadimplenciaModule,
    dependencies.inadimplenciaModule
  );
  const treinamentoModule = await resolveModule(
    createTreinamentoModule,
    dependencies.treinamentoModule
  );
  const fluigModule = await resolveModule(createFluigModule, dependencies.fluigModule);
  const pm2Module = await resolveModule(createPm2Module, dependencies.pm2Module);
  const m365Module = await resolveModule(createM365Module, dependencies.m365Module);
  const estoqueOnlineModule = await resolveModule(
    createEstoqueOnlineModule,
    dependencies.estoqueOnlineModule
  );
  const glpiModule = await resolveModule(createGlpiModule, dependencies.glpiModule);
  const authModule = await resolveModule(createAuthModule, dependencies.authModule);
  const rmModule = await resolveModule(createRmModule, dependencies.rmModule);
  const entradaNotaFiscalModule = await resolveModule(
    createEntradaNotaFiscalModule,
    dependencies.entradaNotaFiscalModule
  );

  const unifiedOpenapi = buildUnifiedOpenapi(
    inadimplenciaModule.openapi,
    treinamentoModule.openapi,
    fluigModule.openapi,
    pm2Module.openapi,
    m365Module.openapi,
    estoqueOnlineModule.openapi,
    glpiModule.openapi,
    authModule.openapi,
    rmModule.openapi,
    entradaNotaFiscalModule.openapi
  );
  const inadimplenciaOpenapi = buildInadimplenciaOpenapi(inadimplenciaModule.openapi);
  const treinamentoOpenapi = buildTreinamentoOpenapi(treinamentoModule.openapi);
  const fluigOpenapi = buildFluigOpenapi(fluigModule.openapi);
  const pm2Openapi = buildPm2Openapi(pm2Module.openapi);
  const m365Openapi = buildM365Openapi(m365Module.openapi);
  const estoqueOnlineOpenapi = buildEstoqueOnlineOpenapi(estoqueOnlineModule.openapi);
  const glpiOpenapi = buildGlpiOpenapi(glpiModule.openapi);
  const authOpenapi = buildAuthOpenapi(authModule.openapi);
  const rmOpenapi = buildRmOpenapi(rmModule.openapi);
  const entradaNotaFiscalOpenapi = buildEntradaNotaFiscalOpenapi(
    entradaNotaFiscalModule.openapi
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/inadimplencia', inadimplenciaModule.router);
  app.use('/treinamento', treinamentoModule.router);
  app.use('/smtpfluig', fluigModule.router);
  app.use('/pm2', pm2Module.router);
  app.use('/m365', m365Module.router);
  app.use('/estoque-online', estoqueOnlineModule.router);
  app.use('/glpi', glpiModule.router);
  app.use('/auth', authModule.router);
  app.use('/rm', rmModule.router);
  app.use('/entrada-nota-fiscal', entradaNotaFiscalModule.router);

  app.locals.realtimeAttachers = [
    ...(app.locals.realtimeAttachers ?? []),
    pm2Module.attachRealtimeServer,
  ];

  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(null, {
      explorer: true,
      customSiteTitle: 'API JotaNunes Construtora - Docs',
      swaggerOptions: {
        urls: [
          { url: '/docs-json/inadimplencia', name: '/inadimplencia' },
          { url: '/docs-json/treinamento', name: '/treinamento' },
          { url: '/docs-json/smtpfluig', name: '/smtpfluig' },
          { url: '/docs-json/pm2', name: '/pm2' },
          { url: '/docs-json/m365', name: '/m365' },
          { url: '/docs-json/estoque-online', name: '/estoque-online' },
          { url: '/docs-json/glpi', name: '/glpi' },
          { url: '/docs-json/auth', name: '/auth' },
          { url: '/docs-json/rm', name: '/rm' },
          { url: '/docs-json/entrada-nota-fiscal', name: '/entrada-nota-fiscal' },
        ],
        'urls.primaryName': '/inadimplencia',
      },
    })
  );
  app.get('/docs-json', (_req, res) => {
    res.json(unifiedOpenapi);
  });
  app.get('/docs-json/inadimplencia', (_req, res) => {
    res.json(inadimplenciaOpenapi);
  });
  app.get('/docs-json/treinamento', (_req, res) => {
    res.json(treinamentoOpenapi);
  });
  app.get('/docs-json/smtpfluig', (_req, res) => {
    res.json(fluigOpenapi);
  });
  app.get('/docs-json/pm2', (_req, res) => {
    res.json(pm2Openapi);
  });
  app.get('/docs-json/m365', (_req, res) => {
    res.json(m365Openapi);
  });
  app.get('/docs-json/estoque-online', (_req, res) => {
    res.json(estoqueOnlineOpenapi);
  });
  app.get('/docs-json/glpi', (_req, res) => {
    res.json(glpiOpenapi);
  });
  app.get('/docs-json/auth', (_req, res) => {
    res.json(authOpenapi);
  });
  app.get('/docs-json/rm', (_req, res) => {
    res.json(rmOpenapi);
  });
  app.get('/docs-json/entrada-nota-fiscal', (_req, res) => {
    res.json(entradaNotaFiscalOpenapi);
  });

  app.use((_, res) => {
    res.status(404).json({ error: 'Endpoint nao encontrado' });
  });

  app.use((err, _req, res, _next) => {
    if (err?.statusCode && err?.message) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return app;
}

module.exports = {
  createApp,
};
