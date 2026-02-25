require('dotenv').config();
const { createApp } = require('./app');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

createApp()
  .then((app) => {
    app.listen(PORT, () => {
      console.log(`API rodando na porta ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Falha ao iniciar a API:', error);
    process.exit(1);
  });
