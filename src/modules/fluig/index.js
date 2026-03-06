const cors = require('cors');
const { Router } = require('express');
const auditRoutes = require('./routes/auditRoutes');
const openapi = require('./swagger');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { env } = require('./config/env');

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (env.CORS_ALLOW_ALL) {
    return true;
  }

  return env.CORS_ORIGINS.includes(origin.toLowerCase());
}

function createFluigModule() {
  const router = Router();
  const corsOptions = {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  router.use(cors(corsOptions));
  router.options('*', cors(corsOptions));
  router.use((req, res, next) => {
    const origin = String(req.headers.origin ?? '').trim().toLowerCase();

    if (isAllowedOrigin(origin)) {
      next();
      return;
    }

    res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  });

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.use('/', auditRoutes);
  router.use(notFoundHandler);
  router.use(errorHandler);

  return {
    router,
    openapi,
  };
}

module.exports = {
  createFluigModule,
};
