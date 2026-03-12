import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import openapi from './docs/openapi';
import { env } from './config/env';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';

const { createCorsOptionsDelegate, isRequestAllowed } = require('../../shared/swaggerAccess');

const app = express();
const corsOptions = createCorsOptionsDelegate(env);

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

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.status(env.isConfigured ? 200 : 503).json({
    status: env.isConfigured ? 'ok' : 'degraded',
    module: 'rm',
    configured: env.isConfigured,
    missingRequired: env.missingRequired,
  });
});

app.use('/rm', routes);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.get('/docs-json', (_req, res) => res.json(openapi));

app.use(notFound);
app.use(errorHandler);

export default app;
