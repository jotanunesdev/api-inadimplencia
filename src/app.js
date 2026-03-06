const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { createInadimplenciaModule } = require('./modules/inadimplencia');
const { createTreinamentoModule } = require('./modules/treinamento');
const { createFluigModule } = require('./modules/fluig');
const {
  buildUnifiedOpenapi,
  buildInadimplenciaOpenapi,
  buildTreinamentoOpenapi,
  buildFluigOpenapi,
} = require('./docs/unifiedOpenapi');

async function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  const inadimplenciaModule = createInadimplenciaModule();
  const treinamentoModule = await createTreinamentoModule();
  const fluigModule = createFluigModule();

  const unifiedOpenapi = buildUnifiedOpenapi(
    inadimplenciaModule.openapi,
    treinamentoModule.openapi,
    fluigModule.openapi
  );
  const inadimplenciaOpenapi = buildInadimplenciaOpenapi(inadimplenciaModule.openapi);
  const treinamentoOpenapi = buildTreinamentoOpenapi(treinamentoModule.openapi);
  const fluigOpenapi = buildFluigOpenapi(fluigModule.openapi);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/inadimplencia', inadimplenciaModule.router);
  app.use('/treinamento', treinamentoModule.router);
  app.use('/fluig', fluigModule.router);

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
          { url: '/docs-json/fluig', name: '/fluig' },
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
  app.get('/docs-json/fluig', (_req, res) => {
    res.json(fluigOpenapi);
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
