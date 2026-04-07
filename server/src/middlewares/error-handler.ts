import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      mensaje: 'Error de validación',
      errores: err.flatten(),
    });
  }

  logger.error({ err, ruta: req.originalUrl }, 'Error no controlado');

  return res.status(500).json({
    mensaje: 'Error interno del servidor',
  });
}
