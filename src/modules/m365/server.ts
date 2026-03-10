import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

app.listen(env.PORT, () => {
  logger.info('M365Server', `Modulo M365 rodando na porta ${env.PORT}.`);
});
