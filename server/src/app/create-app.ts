import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from '../config/env.js';
import { errorHandler } from '../middlewares/error-handler.js';
import { apiRouter } from '../routes/index.js';
import { logger } from '../utils/logger.js';

export function createApp() {
  const app = express();

  app.use((req, _res, next) => {
    logger.info({ metodo: req.method, ruta: req.originalUrl }, 'Solicitud recibida');
    next();
  });
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api', apiRouter);
  app.use(errorHandler);

  return app;
}
