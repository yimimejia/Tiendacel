import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { listRoles } from './service.js';

export async function listRolesController(_req: Request, res: Response) {
  const data = await listRoles();
  return sendSuccess(res, 'Roles obtenidos correctamente', data);
}
