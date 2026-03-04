const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const { createInadimplenciaModule } = require('./modules/inadimplencia');
const { createTreinamentoModule } = require('./modules/treinamento');
const {
  buildUnifiedOpenapi,
  buildInadimplenciaOpenapi,
  buildTreinamentoOpenapi,
} = require('./docs/unifiedOpenapi');

dotenv.config();

function parseAllowedOrigins(value) {
  const origins = String(value ?? '')
    .split(',')
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean);

  return {
    origins: new Set(origins),
    allowAll: origins.includes('*'),
  };
}

function buildCorsOptions(allowedOrigins) {
  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, false);
        return;
      }

      if (allowedOrigins.allowAll) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.origins.has(origin.toLowerCase()));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

function buildOriginGuard(allowedOrigins) {
  return (req, res, next) => {
    const origin = String(req.headers.origin ?? '').trim().toLowerCase();

    if (!origin) {
      res.status(403).json({ error: 'Origem nao permitida.' });
      return;
    }

    if (allowedOrigins.allowAll || allowedOrigins.origins.has(origin)) {
      next();
      return;
    }

    res.status(403).json({ error: 'Origem nao permitida.' });
  };
}

async function createApp() {
  const app = express();
  const inadAllowedOrigins = parseAllowedOrigins(process.env.INAD_CORS_ORIGIN);
  const treinAllowedOrigins = parseAllowedOrigins(process.env.TREIN_CORS_ORIGIN);
  const inadCors = buildCorsOptions(inadAllowedOrigins);
  const treinCors = buildCorsOptions(treinAllowedOrigins);
  const inadOriginGuard = buildOriginGuard(inadAllowedOrigins);
  const treinOriginGuard = buildOriginGuard(treinAllowedOrigins);

  app.use(express.json({ limit: '10mb' }));

  const inadimplenciaModule = createInadimplenciaModule();
  const treinamentoModule = await createTreinamentoModule();

  const unifiedOpenapi = buildUnifiedOpenapi(
    inadimplenciaModule.openapi,
    treinamentoModule.openapi
  );
  const inadimplenciaOpenapi = buildInadimplenciaOpenapi(inadimplenciaModule.openapi);
  const treinamentoOpenapi = buildTreinamentoOpenapi(treinamentoModule.openapi);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/inadimplencia', cors(inadCors), inadOriginGuard, inadimplenciaModule.router);
  app.use('/treinamento', cors(treinCors), treinOriginGuard, treinamentoModule.router);

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
