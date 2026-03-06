const { createStandaloneApp } = require('./standaloneApp');
const { env } = require('./config/env');

const PORT = env.PORT ? Number(env.PORT) : 3001;
const app = createStandaloneApp();

app.listen(PORT, () => {
  console.log(`Modulo inadimplencia rodando na porta ${PORT}`);
});
