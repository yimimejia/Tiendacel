import type { Request, Response } from 'express';
import { createAuditLog } from '../../services/audit-log.service.js';
import { sendList, sendSuccess } from '../../utils/api-response.js';
import { createUser, getUserById, listUsers, resetPassword, toggleUserStatus, updateUser } from './service.js';

export async function listUsersController(req: Request, res: Response) {
  const result = await listUsers(req.query);
  return sendList(res, result.data, result.meta, 'Usuarios obtenidos correctamente');
}

export async function getUserController(req: Request, res: Response) {
  const data = await getUserById(Number(req.params.id));
  return sendSuccess(res, 'Usuario obtenido correctamente', data);
}

export async function createUserController(req: Request, res: Response) {
  const data = await createUser(req.body);

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId: data.branch_id,
    action: 'user_create',
    entity: 'users',
    entityId: String(data.id),
    description: `Usuario creado: ${data.username_or_email}`,
  });

  return sendSuccess(res, 'Usuario creado correctamente', data, 201);
}

export async function updateUserController(req: Request, res: Response) {
  const data = await updateUser(Number(req.params.id), req.body);

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId: data.branch_id,
    action: 'user_update',
    entity: 'users',
    entityId: String(data.id),
    description: `Usuario actualizado: ${data.username_or_email}`,
  });

  return sendSuccess(res, 'Usuario actualizado correctamente', data);
}

export async function resetPasswordController(req: Request, res: Response) {
  await resetPassword(Number(req.params.id), req.body.password);

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId: null,
    action: 'user_reset_password',
    entity: 'users',
    entityId: String(req.params.id),
    description: 'Contraseña restablecida',
  });

  return sendSuccess(res, 'Contraseña actualizada correctamente', null);
}

export async function toggleUserStatusController(req: Request, res: Response) {
  const data = await toggleUserStatus(Number(req.params.id), req.body.is_active);

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId: data.branch_id,
    action: 'user_toggle_status',
    entity: 'users',
    entityId: String(data.id),
    description: `Usuario ${data.is_active ? 'activado' : 'desactivado'}`,
  });

  return sendSuccess(res, 'Estado de usuario actualizado correctamente', data);
}
