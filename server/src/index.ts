import { createApp } from './app/create-app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      corsOrigins: env.corsOrigins,
      uploadDir: env.UPLOAD_DIR,
      serveFrontend: env.SERVE_FRONTEND,
    },
    'Vibran Tech API started',
  );
});
