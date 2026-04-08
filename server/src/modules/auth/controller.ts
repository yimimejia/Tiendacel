import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { createAuditLog } from '../../services/audit-log.service.js';
import { HttpError } from '../../utils/http-error.js';
import { getMe, login } from './service.js';

export async function loginController(req: Request, res: Response) {
  const { username_or_email: usernameOrEmail, password } = req.body;
  const result = await login(usernameOrEmail, password);

  res.cookie('access_token', result.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
  });

  await createAuditLog({
    userId: result.user.id,
    branchId: result.user.branch_id,
    action: 'login',
    entity: 'auth',
    entityId: String(result.user.id),
    description: `Inicio de sesión de ${result.user.username_or_email}`,
  });

  return sendSuccess(res, 'Login exitoso', result);
}

export async function logoutController(_req: Request, res: Response) {
  res.clearCookie('access_token');
  return sendSuccess(res, 'Logout exitoso', null);
}

export async function meController(req: Request, res: Response) {
  if (!req.user) throw new HttpError(401, 'No autenticado');

  const data = await getMe(Number(req.user.id));
  return sendSuccess(res, 'Perfil obtenido correctamente', data);
}
