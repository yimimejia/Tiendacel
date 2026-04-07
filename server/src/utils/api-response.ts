import type { Response } from 'express';

export function sendSuccess<T>(res: Response, message: string, data: T, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendList<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
  message = 'Listado obtenido correctamente',
) {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta,
  });
}
