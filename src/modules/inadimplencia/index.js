const { Router } = require('express');
const cors = require('cors');
const inadimplenciaRoutes = require('./routes/inadimplenciaRoutes');
const proximaAcaoRoutes = require('./routes/proximaAcaoRoutes');
const ocorrenciasRoutes = require('./routes/ocorrenciasRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const responsavelRoutes = require('./routes/responsavelRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const kanbanStatusRoutes = require('./routes/kanbanStatusRoutes');
const atendimentosRoutes = require('./routes/atendimentosRoutes');
const relatoriosRoutes = require('./routes/relatoriosRoutes');
const fiadoresRoutes = require('./routes/fiadoresRoutes');
const errorHandler = require('./middlewares/errorHandler');
const notificationsRoutes = require('./routes/notificationsRoutes');
const openapi = require('./swagger');
const { env } = require('./config/env');
const { createCorsOptionsDelegate, isRequestAllowed } = require('../../shared/swaggerAccess');
const overdueScanner = require('./services/overdueScanner');

function createInadimplenciaModule() {
  const router = Router();
  const originGuard = (req, res, next) => {
    if (isRequestAllowed(req, env)) {
      next();
      return;
    }

    res.status(403).json({ error: 'Origem nao permitida.' });
  };
  const corsOptions = createCorsOptionsDelegate(env);

  router.use(cors(corsOptions));
  router.options('*', cors(corsOptions));
  router.use(originGuard);

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.use('/', inadimplenciaRoutes);
  router.use('/proximas-acoes', proximaAcaoRoutes);
  router.use('/ocorrencias', ocorrenciasRoutes);
  router.use('/usuarios', usuarioRoutes);
  router.use('/responsaveis', responsavelRoutes);
  router.use('/dashboard', dashboardRoutes);
  router.use('/kanban-status', kanbanStatusRoutes);
  router.use('/atendimentos', atendimentosRoutes);
  router.use('/relatorios', relatoriosRoutes);
  router.use('/fiadores', fiadoresRoutes);
  router.use('/notifications', notificationsRoutes);

  router.use((_, res) => {
    res.status(404).json({ error: 'Endpoint nao encontrado' });
  });

  router.use(errorHandler);

  // Start the overdue scanner for VENDA_ATRASADA notifications
  overdueScanner.start();

  return {
    router,
    openapi,
  };
}

module.exports = {
  createInadimplenciaModule,
};
