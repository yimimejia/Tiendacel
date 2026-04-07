import type { Request, Response } from 'express';
import { createAuditLog } from '../../services/audit-log.service.js';
import { sendList, sendSuccess } from '../../utils/api-response.js';
import { createCustomer, getCustomerDetail, listCustomers, updateCustomer } from './service.js';

export async function listCustomersController(req: Request, res: Response) {
  const result = await listCustomers(req.query);
  return sendList(res, result.data, result.meta, 'Clientes obtenidos correctamente');
}

export async function createCustomerController(req: Request, res: Response) {
  const data = await createCustomer(req.body);

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId: req.user?.branchId ? Number(req.user.branchId) : null,
    action: 'customer_create',
    entity: 'customers',
    entityId: String(data.id),
    description: `Cliente creado: ${data.full_name}`,
  });

  return sendSuccess(res, 'Cliente creado correctamente', data, 201);
}

export async function getCustomerDetailController(req: Request, res: Response) {
  const data = await getCustomerDetail(Number(req.params.id));
  return sendSuccess(res, 'Cliente obtenido correctamente', data);
}

export async function updateCustomerController(req: Request, res: Response) {
  const data = await updateCustomer(Number(req.params.id), req.body);

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId: req.user?.branchId ? Number(req.user.branchId) : null,
    action: 'customer_update',
    entity: 'customers',
    entityId: String(data.id),
    description: `Cliente actualizado: ${data.full_name}`,
  });

  return sendSuccess(res, 'Cliente actualizado correctamente', data);
}
