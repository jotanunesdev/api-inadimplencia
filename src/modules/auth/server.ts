import app from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  console.log(`Modulo auth rodando na porta ${env.PORT}`);
});
