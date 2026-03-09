const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { createFluigModule } = require('./index');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

function createApp() {
  const app = express();
  const fluigModule = createFluigModule();

  app.use(express.json({ limit: '200kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/smtpfluig', fluigModule.router);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(fluigModule.openapi));
  app.get('/docs-json', (_req, res) => {
    res.json(fluigModule.openapi);
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
