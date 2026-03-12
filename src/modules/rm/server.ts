import app from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  console.log(`Modulo rm rodando na porta ${env.PORT}`);
});
