const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
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
const swaggerSpec = require('./swagger');
const { env } = require('./config/env');

const app = express();
const originGuard = (req, res, next) => {
  const origin = String(req.headers.origin ?? '').trim().toLowerCase();

  if (!origin) {
    res.status(403).json({ error: 'Origem nao permitida.' });
    return;
  }

  if (env.CORS_ALLOW_ALL || env.CORS_ORIGINS.includes(origin)) {
    next();
    return;
  }

  res.status(403).json({ error: 'Origem nao permitida.' });
};
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, false);
      return;
    }

    if (env.CORS_ALLOW_ALL) {
      callback(null, true);
      return;
    }

    callback(null, env.CORS_ORIGINS.includes(origin.toLowerCase()));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(originGuard);
app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs-json', (req, res) => {
  res.json(swaggerSpec);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/inadimplencia', inadimplenciaRoutes);
app.use('/proximas-acoes', proximaAcaoRoutes);
app.use('/ocorrencias', ocorrenciasRoutes);
app.use('/usuarios', usuarioRoutes);
app.use('/responsaveis', responsavelRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/kanban-status', kanbanStatusRoutes);
app.use('/atendimentos', atendimentosRoutes);
app.use('/relatorios', relatoriosRoutes);

app.use(errorHandler);

module.exports = app;
