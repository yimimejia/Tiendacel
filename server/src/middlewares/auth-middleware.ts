import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { roles, users } from '../db/schema.js';
import { HttpError } from '../utils/http-error.js';

interface AuthPayload {
  userId: number;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const tokenFromCookie = req.cookies?.access_token as string | undefined;
    const tokenFromQuery = typeof req.query?.token === 'string' ? req.query.token : null;
    const token = tokenFromHeader ?? tokenFromCookie ?? tokenFromQuery;

    if (!token) {
      throw new HttpError(401, 'No autenticado');
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;

    const [user] = await db
      .select({ id: users.id, role: roles.name, branchId: users.branchId, isActive: users.isActive })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new HttpError(401, 'Usuario inválido o inactivo');
    }

    req.user = {
      id: String(user.id),
      role: user.role,
      branchId: user.branchId ? String(user.branchId) : null,
    };

    next();
  } catch (error) {
    next(error);
  }
}
