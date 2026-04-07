import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import {
  checkBranchPaused,
  createOrUpdateSubscription,
  deletePayment,
  getPaymentHistory,
  getSubscriptionByBranch,
  listSubscriptions,
  pauseSubscription,
  recordPayment,
} from './service.js';

export async function listSubscriptionsController(req: Request, res: Response) {
  const data = await listSubscriptions();
  return sendSuccess(res, 'Suscripciones obtenidas correctamente', data);
}

export async function getSubscriptionController(req: Request, res: Response) {
  const data = await getSubscriptionByBranch(Number(req.params.branchId));
  return sendSuccess(res, 'Suscripción obtenida correctamente', data);
}

export async function getPaymentHistoryController(req: Request, res: Response) {
  const data = await getPaymentHistory(Number(req.params.branchId));
  return sendSuccess(res, 'Historial de pagos obtenido correctamente', data);
}

export async function upsertSubscriptionController(req: Request, res: Response) {
  const data = await createOrUpdateSubscription({
    ...req.body,
    branch_id: Number(req.params.branchId ?? req.body.branch_id),
  });
  return sendSuccess(res, 'Suscripción guardada correctamente', data);
}

export async function pauseSubscriptionController(req: Request, res: Response) {
  const pause = req.body.pause === true || req.body.pause === 'true';
  const data = await pauseSubscription(Number(req.params.branchId), pause);
  return sendSuccess(res, pause ? 'Sucursal pausada correctamente' : 'Sucursal reactivada correctamente', data);
}

export async function recordPaymentController(req: Request, res: Response) {
  const data = await recordPayment({
    branch_id: Number(req.params.branchId),
    amount: Number(req.body.amount),
    payment_method: req.body.payment_method ?? 'efectivo',
    note: req.body.note ?? null,
    recorded_by_user_id: Number(req.user!.id),
    advance_due_date: req.body.advance_due_date !== false,
  });
  return sendSuccess(res, 'Pago registrado correctamente', data, 201);
}

export async function deletePaymentController(req: Request, res: Response) {
  await deletePayment(Number(req.params.paymentId));
  return sendSuccess(res, 'Pago eliminado correctamente', null);
}

export async function branchStatusController(req: Request, res: Response) {
  const branchId = req.user?.branchId ? Number(req.user.branchId) : null;
  if (!branchId) return sendSuccess(res, 'Sin sucursal asignada', { isPaused: false });
  const data = await checkBranchPaused(branchId);
  return sendSuccess(res, 'Estado obtenido correctamente', data);
}
