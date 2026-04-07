import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { env } from '../config/env.js';
import { errorHandler } from '../middlewares/error-handler.js';
import { apiRouter } from '../routes/index.js';
import { logger } from '../utils/logger.js';
import { ensureDirectoryExists, resolveFromRepo } from '../utils/paths.js';

export function createApp() {
  const app = express();

  const uploadDir = resolveFromRepo(env.UPLOAD_DIR);
  ensureDirectoryExists(uploadDir);

  app.use((req, _res, next) => {
    logger.info({ method: req.method, route: req.originalUrl }, 'Incoming request');
    next();
  });

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/uploads', express.static(uploadDir));
  app.use('/api', apiRouter);

  if (env.SERVE_FRONTEND) {
    const distPath = resolveFromRepo(env.FRONTEND_DIST_PATH);
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      return res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
