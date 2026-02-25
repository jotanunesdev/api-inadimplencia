const app = require('./legacyApp');
const { env } = require('./config/env');

const PORT = env.PORT ? Number(env.PORT) : 3001;

app.listen(PORT, () => {
  console.log(`Modulo inadimplencia rodando na porta ${PORT}`);
});
