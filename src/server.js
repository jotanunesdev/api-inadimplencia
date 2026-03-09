require('dotenv').config();
const http = require('http');
const { createApp } = require('./app');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

createApp()
  .then((app) => {
    const server = http.createServer(app);
    const realtimeAttachers = app.locals.realtimeAttachers ?? [];

    realtimeAttachers.forEach((attach) => {
      if (typeof attach === 'function') {
        attach(server);
      }
    });

    server.listen(PORT, () => {
      console.log(`API rodando na porta ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Falha ao iniciar a API:', error);
    process.exit(1);
  });
