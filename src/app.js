const express = require('express');
const cors = require('cors');
const inadimplenciaRoutes = require('./routes/inadimplenciaRoutes');
const proximaAcaoRoutes = require('./routes/proximaAcaoRoutes');
const ocorrenciasRoutes = require('./routes/ocorrenciasRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const responsavelRoutes = require('./routes/responsavelRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const kanbanStatusRoutes = require('./routes/kanbanStatusRoutes');
const atendimentosRoutes = require('./routes/atendimentosRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

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

app.use(errorHandler);

module.exports = app;
