import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
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

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  app.use('/uploads', express.static(uploadDir));
  app.use('/api', apiRouter);

  const distPath = resolveFromRepo(env.FRONTEND_DIST_PATH);
  const indexFilePath = path.join(distPath, 'index.html');
  const canServeFrontend = env.SERVE_FRONTEND || fs.existsSync(indexFilePath);

  if (canServeFrontend) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      return res.sendFile(indexFilePath);
    });
  } else {
    app.get('/', (req, res) => {
      const acceptsHtml = req.headers.accept?.includes('text/html');
      if (acceptsHtml) {
        return res.redirect(env.FRONTEND_URL);
      }

      res.status(200).json({
        success: true,
        message: 'Backend activo. Frontend no compilado aún.',
        data: { frontend: env.FRONTEND_URL, health: '/api/health', docs: 'Ejecuta el build del cliente o configura SERVE_FRONTEND=true' },
      });
    });
  }

  app.use(errorHandler);

  return app;
}
