import { createApp } from './app/create-app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Servidor de Vibran Tech escuchando en puerto ${env.PORT}`);
});
