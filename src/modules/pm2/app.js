const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { createPm2Module } = require('./index');

function createApp() {
  const app = express();
  const pm2Module = createPm2Module();
  console.log("oi")
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/pm2', pm2Module.router);
  app.locals.realtimeAttachers = [
    ...(app.locals.realtimeAttachers ?? []),
    pm2Module.attachRealtimeServer,
  ];

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(pm2Module.openapi));
  app.get('/docs-json', (_req, res) => {
    res.json(pm2Module.openapi);
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
