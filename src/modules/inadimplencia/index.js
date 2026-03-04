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
const errorHandler = require('./middlewares/errorHandler');
const openapi = require('./swagger');
const { env } = require('./config/env');

function createInadimplenciaModule() {
  const router = Router();
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin || env.CORS_ALLOW_ALL) {
        callback(null, true);
        return;
      }

      callback(null, env.CORS_ORIGINS.includes(origin.toLowerCase()));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  router.use(cors(corsOptions));
  router.options('*', cors(corsOptions));

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

  router.use((_, res) => {
    res.status(404).json({ error: 'Endpoint nao encontrado' });
  });

  router.use(errorHandler);

  return {
    router,
    openapi,
  };
}

module.exports = {
  createInadimplenciaModule,
};
