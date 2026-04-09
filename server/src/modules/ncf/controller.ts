import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { HttpError } from '../../utils/http-error.js';
import { NCF_TYPES, deleteNcfSequence, getNextNcf, listNcfSequences, patchNcfSequence, upsertNcfSequence } from './service.js';

function resolveBranchId(req: Request): number {
  const role = String(req.user?.role ?? '');
  if (role === 'admin_supremo') {
    const candidate = Number(req.query.branch_id ?? req.body?.branch_id ?? 0);
    if (!candidate) throw new HttpError(400, 'branch_id es requerido');
    return candidate;
  }
  if (!req.user?.branchId) throw new HttpError(403, 'Usuario sin sucursal asignada');
  return Number(req.user.branchId);
}

export async function getNcfTypesController(_req: Request, res: Response) {
  return sendSuccess(res, 'Tipos de NCF', NCF_TYPES);
}

export async function listNcfController(req: Request, res: Response) {
  const branchId = resolveBranchId(req);
  const data = await listNcfSequences(branchId);
  return sendSuccess(res, 'Secuencias NCF obtenidas', data);
}

export async function upsertNcfController(req: Request, res: Response) {
  const branchId = resolveBranchId(req);
  const { type, sequence_from, sequence_to, alert_threshold, is_active } = req.body;
  if (!type) throw new HttpError(400, 'El tipo de NCF es obligatorio');
  if (!sequence_from || !sequence_to) throw new HttpError(400, 'Secuencia desde y hasta son obligatorias');
  const data = await upsertNcfSequence(branchId, {
    type: String(type),
    sequence_from: Number(sequence_from),
    sequence_to: Number(sequence_to),
    alert_threshold: alert_threshold ? Number(alert_threshold) : undefined,
    is_active: is_active !== undefined ? Boolean(is_active) : undefined,
  });
  return sendSuccess(res, 'Secuencia NCF guardada correctamente', data);
}

export async function patchNcfController(req: Request, res: Response) {
  const branchId = resolveBranchId(req);
  const id = Number(req.params.id);
  if (!id) throw new HttpError(400, 'ID inválido');
  const { is_active, alert_threshold, sequence_to } = req.body;
  const data = await patchNcfSequence(id, branchId, {
    is_active: is_active !== undefined ? Boolean(is_active) : undefined,
    alert_threshold: alert_threshold !== undefined ? Number(alert_threshold) : undefined,
    sequence_to: sequence_to !== undefined ? Number(sequence_to) : undefined,
  });
  return sendSuccess(res, 'Secuencia NCF actualizada', data);
}

export async function deleteNcfController(req: Request, res: Response) {
  const branchId = resolveBranchId(req);
  const id = Number(req.params.id);
  if (!id) throw new HttpError(400, 'ID inválido');
  await deleteNcfSequence(id, branchId);
  return sendSuccess(res, 'Secuencia NCF eliminada', null);
}

export async function getNextNcfController(req: Request, res: Response) {
  const branchId = resolveBranchId(req);
  const type = String(req.body?.type ?? req.query.type ?? '');
  if (!type) throw new HttpError(400, 'El tipo de NCF es obligatorio');
  const data = await getNextNcf(branchId, type);
  return sendSuccess(res, 'NCF emitido correctamente', data);
}
