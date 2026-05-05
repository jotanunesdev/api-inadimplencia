const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { createGlpiModule } = require('./index');
const { env } = require('./config/env');

const app = express();
const { router, openapi } = createGlpiModule();

app.use(express.json({ limit: '10mb' }));
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use('/glpi', router);
app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapi, {
    explorer: true,
    customSiteTitle: 'API GLPI - JotaNunes',
  })
);

app.use((_, res) => {
  res.status(404).json({ error: 'Endpoint nao encontrado' });
});

app.use((err, _req, res, _next) => {
  if (err?.statusCode && err?.message) {
    res.status(err.statusCode).json({ error: err.message, code: err.code ?? 'APP_ERROR' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const port = Number(process.env.GLPI_PORT || 4010);

if (!env.isConfigured) {
  console.warn('Modulo GLPI standalone iniciado sem configuracao completa.');
}

app.listen(port, () => {
  console.log(`Modulo GLPI standalone na porta ${port}`);
});
