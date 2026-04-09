import type { Request, Response } from 'express';
import { createAuditLog } from '../../services/audit-log.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { assignRepair, getAssignableTechnicians, getRepairInvoiceInfo, listAllBranchCompleted, listRepairsForUser, takeRepairWork, updateRepairStatus } from './service.js';

function getRequestUser(req: Request) {
  return {
    id: Number(req.user?.id),
    role: String(req.user?.role),
    branchId: req.user?.branchId ? Number(req.user.branchId) : null,
  };
}

export async function listRepairsController(req: Request, res: Response) {
  const user = getRequestUser(req);
  const filter = req.query.filter as 'pending' | 'completed' | 'all' | undefined;
  const data = await listRepairsForUser(user, filter);
  return sendSuccess(res, 'Reparaciones obtenidas correctamente', data);
}

export async function listAllCompletedRepairsController(req: Request, res: Response) {
  const user = getRequestUser(req);
  const search = (req.query.search as string ?? '').trim();
  const data = await listAllBranchCompleted(user, search || undefined);
  return sendSuccess(res, 'Trabajos completados obtenidos', data);
}

export async function getRepairInvoiceController(req: Request, res: Response) {
  const user = getRequestUser(req);
  const repairId = Number(req.params.id);
  const data = await getRepairInvoiceInfo(repairId, user);
  return sendSuccess(res, 'Información de factura obtenida', data);
}

export async function listAssignableTechniciansController(req: Request, res: Response) {
  const user = getRequestUser(req);
  if (!user.branchId && user.role !== 'administrador_general' && user.role !== 'admin_supremo') {
    return sendSuccess(res, 'Sin sucursal asignada', []);
  }

  const branchId = Number(req.query.branch_id) || user.branchId;
  if (!branchId) {
    return sendSuccess(res, 'Envía branch_id para listar empleados', []);
  }

  const data = await getAssignableTechnicians(branchId);
  return sendSuccess(res, 'Empleados obtenidos correctamente', data);
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
    description: `Empleado ${user.id} tomó la reparación ${updated.deviceNumber}`,
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

export async function updateRepairStatusController(req: Request, res: Response) {
  const user = getRequestUser(req);
  const repairId = Number(req.params.id);
  const { status } = req.body;

  if (!status) throw new Error('El campo status es requerido');

  const updated = await updateRepairStatus(repairId, status, user);

  await createAuditLog({
    userId: user.id,
    branchId: updated.branchId,
    action: 'repair_status_update',
    entity: 'repairs',
    entityId: String(updated.id),
    description: `Estado reparación ${updated.deviceNumber} → ${status}`,
  });

  return sendSuccess(res, 'Estado actualizado', { id: updated.id, internal_status: updated.internalStatus });
}
