import type { Request, Response } from 'express';
import { createAuditLog } from '../../services/audit-log.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { HttpError } from '../../utils/http-error.js';
import { getAccessibleBranchIdsForUser } from '../branches/service.js';
import { getBranchSettings, upsertBranchSettings } from './service.js';

async function resolveBranchId(req: Request) {
  const role = String(req.user?.role);
  if (role === 'admin_supremo') {
    const candidate = Number(req.query.branch_id ?? req.body.branch_id ?? req.user?.branchId ?? 0);
    if (candidate) return candidate;
    const [firstBranch] = await getAccessibleBranchIdsForUser(Number(req.user?.id), Number(req.user?.branchId ?? 0));
    if (!firstBranch) throw new HttpError(400, 'No hay sucursales disponibles');
    return firstBranch;
  }
  if (role === 'administrador_general') {
    const candidate = Number(req.query.branch_id ?? req.body.branch_id);
    if (!candidate) throw new HttpError(400, 'branch_id es requerido para este rol');
    if (role === 'administrador_general') {
      const branchIds = await getAccessibleBranchIdsForUser(Number(req.user?.id), Number(req.user?.branchId ?? 0));
      if (!branchIds.includes(candidate)) throw new HttpError(403, 'No puedes gestionar la configuración de otra sucursal');
    }
    return candidate;
  }

  if (!req.user?.branchId) throw new HttpError(403, 'Usuario sin sucursal asignada');
  return Number(req.user.branchId);
}

export async function getBranchSettingsController(req: Request, res: Response) {
  const data = await getBranchSettings(await resolveBranchId(req));
  return sendSuccess(res, 'Configuración de sucursal obtenida correctamente', data);
}

export async function upsertBranchSettingsController(req: Request, res: Response) {
  const branchId = await resolveBranchId(req);
  const data = await upsertBranchSettings(branchId, {
    ...req.body,
    warranty_days_default: req.body.warranty_days_default !== undefined ? Number(req.body.warranty_days_default) : undefined,
    block_delivery_with_balance:
      req.body.block_delivery_with_balance !== undefined ? req.body.block_delivery_with_balance === true || req.body.block_delivery_with_balance === 'true' : undefined,
  });

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId,
    action: 'branch_settings_upsert',
    entity: 'branch_settings',
    entityId: String(data.id),
    description: `Configuración de sucursal actualizada: ${branchId}`,
  });

  return sendSuccess(res, 'Configuración de sucursal guardada correctamente', data);
}
