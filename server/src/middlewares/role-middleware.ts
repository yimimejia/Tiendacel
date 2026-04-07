import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';

export function roleMiddleware(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, 'No autenticado'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new HttpError(403, 'No autorizado para esta acción'));
    }

    return next();
  };
}
