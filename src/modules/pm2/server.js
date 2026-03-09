const http = require('http');
const { createApp } = require('./app');
const { env } = require('./config/env');

const app = createApp();
const server = http.createServer(app);
const realtimeAttachers = app.locals.realtimeAttachers ?? [];

realtimeAttachers.forEach((attach) => {
  if (typeof attach === 'function') {
    attach(server);
  }
});

server.listen(env.PORT, () => {
  console.log(`Modulo monitoria rodando na porta ${env.PORT}`);
});
