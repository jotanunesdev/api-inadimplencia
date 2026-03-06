const { Router } = require('express');
const auditRoutes = require('./routes/auditRoutes');
const openapi = require('./swagger');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

function createFluigModule() {
  const router = Router();

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
