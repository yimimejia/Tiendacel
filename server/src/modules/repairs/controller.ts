import type { Request, Response } from 'express';
import { createAuditLog } from '../../services/audit-log.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { assignRepair, getAssignableTechnicians, listRepairsForUser, takeRepairWork } from './service.js';

function getRequestUser(req: Request) {
  return {
    id: Number(req.user?.id),
    role: String(req.user?.role),
    branchId: req.user?.branchId ? Number(req.user.branchId) : null,
  };
}

export async function listRepairsController(req: Request, res: Response) {
  const user = getRequestUser(req);
  const data = await listRepairsForUser(user);
  return sendSuccess(res, 'Reparaciones obtenidas correctamente', data);
}

export async function listAssignableTechniciansController(req: Request, res: Response) {
  const user = getRequestUser(req);
  if (!user.branchId && user.role !== 'administrador_general') {
    return sendSuccess(res, 'Sin sucursal asignada', []);
  }

  const branchId = user.role === 'administrador_general' ? Number(req.query.branch_id) : user.branchId;
  if (!branchId) {
    return sendSuccess(res, 'Envía branch_id para listar técnicos', []);
  }

  const data = await getAssignableTechnicians(branchId);
  return sendSuccess(res, 'Técnicos obtenidos correctamente', data);
}

export async function takeRepairWorkController(req: Request, res: Response) {
  const user = getRequestUser(req);
  const updated = await takeRepairWork(Number(req.params.id), user);

  await createAuditLog({
    userId: user.id,
    branchId: updated.branchId,
    action: 'repair_take_work',
    entity: 'repairs',
    entityId: String(updated.id),
    description: `Técnico ${user.id} tomó la reparación ${updated.deviceNumber}`,
  });

  return sendSuccess(res, 'Trabajo tomado correctamente', {
    id: updated.id,
    technician_id: updated.technicianId,
  });
}

export async function assignRepairController(req: Request, res: Response) {
  const user = getRequestUser(req);
  const repairId = Number(req.params.id);
  const technicianId = req.body.technician_id as number | null;

  const result = await assignRepair(repairId, technicianId, user);

  const action =
    result.previousTechnicianId === null && technicianId !== null
      ? 'repair_assign'
      : result.previousTechnicianId !== null && technicianId === null
        ? 'repair_unassign'
        : 'repair_reassign';

  await createAuditLog({
    userId: user.id,
    branchId: result.updated.branchId,
    action,
    entity: 'repairs',
    entityId: String(result.updated.id),
    description: `Asignación reparación ${result.updated.deviceNumber}: ${result.previousTechnicianId ?? 'sin_asignar'} -> ${technicianId ?? 'sin_asignar'}`,
  });

  return sendSuccess(res, 'Asignación actualizada correctamente', {
    id: result.updated.id,
    technician_id: result.updated.technicianId,
  });
}
