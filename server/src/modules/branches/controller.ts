import type { Request, Response } from 'express';
import { createAuditLog } from '../../services/audit-log.service.js';
import { assertBranchAccess } from '../../middlewares/branch-access-middleware.js';
import { sendList, sendSuccess } from '../../utils/api-response.js';
import { assignAdminBranchAccess, createBranch, getAccessibleBranchIdsForUser, getBranchById, listBranches, toggleBranchStatus, updateBranch } from './service.js';

const UNRESTRICTED_ROLES = ['admin_supremo'];

export async function listBranchesController(req: Request, res: Response) {
  const role = req.user?.role ?? '';
  const accessibleBranchIds = UNRESTRICTED_ROLES.includes(role)
    ? null
    : await getAccessibleBranchIdsForUser(Number(req.user?.id), Number(req.user?.branchId ?? 0));
  const result = await listBranches(req.query, accessibleBranchIds === null ? null : (accessibleBranchIds.length ? accessibleBranchIds : [-1]));
  return sendList(res, result.data, result.meta, 'Sucursales obtenidas correctamente');
}

export async function getBranchController(req: Request, res: Response) {
  const branch = await getBranchById(Number(req.params.id));
  assertBranchAccess(req.user?.role ?? '', req.user?.branchId ?? null, branch.id);
  return sendSuccess(res, 'Sucursal obtenida correctamente', branch);
}

export async function createBranchController(req: Request, res: Response) {
  const branch = await createBranch(req.body);

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId: null,
    action: 'branch_create',
    entity: 'branches',
    entityId: String(branch.id),
    description: `Sucursal creada: ${branch.name}`,
  });

  return sendSuccess(res, 'Sucursal creada correctamente', branch, 201);
}

export async function updateBranchController(req: Request, res: Response) {
  const branch = await updateBranch(Number(req.params.id), req.body);

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId: null,
    action: 'branch_update',
    entity: 'branches',
    entityId: String(branch.id),
    description: `Sucursal actualizada: ${branch.name}`,
  });

  return sendSuccess(res, 'Sucursal actualizada correctamente', branch);
}

export async function toggleBranchStatusController(req: Request, res: Response) {
  const branch = await toggleBranchStatus(Number(req.params.id), req.body.is_active);

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId: null,
    action: 'branch_toggle_status',
    entity: 'branches',
    entityId: String(branch.id),
    description: `Sucursal ${branch.name} ${branch.isActive ? 'activada' : 'desactivada'}`,
  });

  return sendSuccess(res, 'Estado de sucursal actualizado correctamente', branch);
}

export async function assignBranchAccessController(req: Request, res: Response) {
  const branchId = Number(req.params.id);
  const userId = Number(req.body.user_id);
  const assigned = await assignAdminBranchAccess(branchId, userId);
  return sendSuccess(res, 'Acceso de sucursal asignado correctamente', assigned);
}
