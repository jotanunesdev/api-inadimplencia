const { createApp } = require('./app');
const { env } = require('./config/env');

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Modulo fluig rodando na porta ${env.PORT}`);
});
