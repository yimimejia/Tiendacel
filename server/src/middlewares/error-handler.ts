import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      details: err.flatten(),
    });
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Archivo demasiado grande.' : 'Error al procesar archivo.';
    return res.status(400).json({ success: false, message });
  }

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  logger.error({ err, route: req.originalUrl }, 'Error no controlado');

  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    ...(env.NODE_ENV !== 'production' ? { details: err instanceof Error ? err.message : 'Unknown error' } : {}),
  });
}
