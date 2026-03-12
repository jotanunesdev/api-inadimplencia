import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import openapi from './docs/openapi';
import { env } from './config/env';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';
import { ensureDatabaseStructure, getInitializationState } from './services/schemaService';

const { createCorsOptionsDelegate, isRequestAllowed } = require('../../shared/swaggerAccess');

const app = express();
const corsOptions = createCorsOptionsDelegate(env);

if (env.isConfigured) {
  ensureDatabaseStructure().catch(() => {
    // health endpoint exposes initialization state
  });
}

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use((req, res, next) => {
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

app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  const initializationState = getInitializationState();
  const isHealthy = env.isConfigured && (initializationState.ready || !initializationState.lastError);

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    module: 'entrada-nota-fiscal',
    configured: env.isConfigured,
    missingRequired: env.missingRequired,
    initialization: initializationState,
  });
});

app.use('/entrada-nota-fiscal', routes);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.get('/docs-json', (_req, res) => res.json(openapi));

app.use(notFound);
app.use(errorHandler);

export default app;
