import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';

const UNRESTRICTED_ROLES = ['admin_supremo', 'administrador_general'];

export function assertBranchAccess(userRole: string, userBranchId: string | null, targetBranchId: number | null) {
  if (UNRESTRICTED_ROLES.includes(userRole)) return;

  if (!targetBranchId) {
    throw new HttpError(403, 'El recurso no tiene sucursal asociada');
  }

  if (!userBranchId || Number(userBranchId) !== targetBranchId) {
    throw new HttpError(403, 'No puede acceder a datos de otra sucursal');
  }
}

export function branchAccessMiddleware(
  getTargetBranchId: (req: Request) => number | null,
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'No autenticado');
      const branchId = getTargetBranchId(req);
      assertBranchAccess(req.user.role, req.user.branchId, branchId);
      next();
    } catch (error) {
      next(error);
    }
  };
}
