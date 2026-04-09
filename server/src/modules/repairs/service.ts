import { and, asc, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { customers, devices, roles, users } from '../../db/schema.js';
import { HttpError } from '../../utils/http-error.js';

interface RequestUser {
  id: number;
  role: string;
  branchId: number | null;
}

const PENDING_STATUSES = ['Recibido', 'Pendiente', 'En diagnóstico', 'Esperando aprobación', 'En reparación', 'Reparado', 'Listo para entregar'];
const COMPLETED_STATUSES = ['Entregado', 'Cancelado', 'No reparable'];

function toRepairResponse(record: {
  id: number;
  deviceNumber: string;
  branchId: number;
  customerId: number;
  customerName: string | null;
  customerPhone: string | null;
  model: string;
  brand: string;
  reportedIssue: string;
  internalStatus: string;
  technicianId: number | null;
  technicianName: string | null;
  receivedAt: Date;
  deliveredAt: Date | null;
}) {
  return {
    id: record.id,
    repair_number: record.deviceNumber,
    branch_id: record.branchId,
    customer_id: record.customerId,
    customer_name: record.customerName ?? '—',
    customer_phone: record.customerPhone ?? '',
    brand: record.brand,
    model: record.model,
    reported_issue: record.reportedIssue,
    internal_status: record.internalStatus,
    technician_id: record.technicianId,
    technician_name: record.technicianName,
    assignment_status: record.technicianId ? 'asignado' : 'sin_asignar',
    received_at: record.receivedAt,
    delivered_at: record.deliveredAt,
    is_completed: COMPLETED_STATUSES.includes(record.internalStatus),
  };
}

function buildBaseQuery() {
  return db
    .select({
      id: devices.id,
      deviceNumber: devices.deviceNumber,
      branchId: devices.branchId,
      customerId: devices.customerId,
      customerName: customers.fullName,
      customerPhone: customers.phone,
      model: devices.model,
      brand: devices.brand,
      reportedIssue: devices.reportedIssue,
      internalStatus: devices.internalStatus,
      technicianId: devices.technicianId,
      technicianName: users.fullName,
      receivedAt: devices.receivedAt,
      deliveredAt: devices.deliveredAt,
    })
    .from(devices)
    .leftJoin(customers, eq(devices.customerId, customers.id))
    .leftJoin(users, eq(devices.technicianId, users.id));
}

const BRANCH_ROLES = ['mensajero', 'empleado', 'caja_ventas', 'encargado_sucursal', 'tecnico'];

export async function listRepairsForUser(user: RequestUser, filter?: 'pending' | 'completed' | 'all') {
  const resolvedFilter = filter ?? 'all';
  const base = buildBaseQuery();

  let rows: any[];

  if (user.role === 'administrador_general') {
    rows = await base.orderBy(desc(devices.receivedAt));
  } else if (user.role === 'admin_supremo') {
    rows = await base.orderBy(desc(devices.receivedAt));
  } else {
    if (!user.branchId) throw new HttpError(403, 'Usuario sin sucursal asignada.');

    if (user.role === 'encargado_sucursal') {
      rows = await base.where(eq(devices.branchId, user.branchId)).orderBy(desc(devices.receivedAt));
    } else if (BRANCH_ROLES.includes(user.role)) {
      rows = await base
        .where(and(
          eq(devices.branchId, user.branchId),
          or(eq(devices.technicianId, user.id), isNull(devices.technicianId)),
        ))
        .orderBy(desc(devices.receivedAt));
    } else {
      throw new HttpError(403, 'No autorizado para ver reparaciones.');
    }
  }

  const all = rows.map(toRepairResponse);

  if (resolvedFilter === 'pending') return all.filter(r => !r.is_completed);
  if (resolvedFilter === 'completed') return all.filter(r => r.is_completed);
  return all;
}

export async function getAssignableTechnicians(branchId: number) {
  const rows = await db
    .select({ id: users.id, fullName: users.fullName, branchId: users.branchId, roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(
      eq(users.isActive, true),
      eq(users.branchId, branchId),
      inArray(roles.name, ['tecnico', 'encargado_sucursal', 'caja_ventas', 'administrador_general', 'mensajero', 'empleado']),
    ));

  return rows.map((row) => ({
    id: row.id,
    full_name: row.fullName,
    branch_id: row.branchId,
    role_name: row.roleName,
  }));
}

async function getRepairById(repairId: number) {
  const [repair] = await db.select().from(devices).where(eq(devices.id, repairId)).limit(1);
  if (!repair) throw new HttpError(404, 'Reparación no encontrada');
  return repair;
}

async function validateTechnicianForBranch(technicianId: number, branchId: number) {
  const [employee] = await db
    .select({ id: users.id, fullName: users.fullName, branchId: users.branchId, roleName: roles.name, isActive: users.isActive })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, technicianId))
    .limit(1);

  if (!employee || !employee.isActive) {
    throw new HttpError(400, 'Empleado/técnico inválido o inactivo');
  }

  if (employee.branchId !== branchId) {
    throw new HttpError(400, 'El empleado debe pertenecer a la misma sucursal de la reparación');
  }

  if (!['tecnico', 'encargado_sucursal', 'caja_ventas', 'administrador_general', 'mensajero', 'empleado'].includes(employee.roleName)) {
    throw new HttpError(400, 'El usuario seleccionado no puede recibir reparaciones');
  }

  return employee;
}

export async function takeRepairWork(repairId: number, user: RequestUser) {
  if (!['tecnico', 'mensajero', 'empleado', 'encargado_sucursal'].includes(user.role)) {
    throw new HttpError(403, 'No tienes permiso para tomar trabajos');
  }

  const repair = await getRepairById(repairId);

  if (!user.branchId || repair.branchId !== user.branchId) {
    throw new HttpError(403, 'Solo puedes tomar trabajos de tu sucursal');
  }

  if (repair.technicianId) {
    throw new HttpError(409, 'La reparación ya está asignada');
  }

  const [updated] = await db
    .update(devices)
    .set({ technicianId: user.id, updatedAt: new Date() })
    .where(eq(devices.id, repairId))
    .returning();

  return updated;
}

export async function assignRepair(repairId: number, technicianId: number | null, user: RequestUser) {
  if (!['administrador_general', 'encargado_sucursal'].includes(user.role)) {
    throw new HttpError(403, 'No autorizado para asignar reparaciones');
  }

  const repair = await getRepairById(repairId);

  if (user.role === 'encargado_sucursal' && user.branchId !== repair.branchId) {
    throw new HttpError(403, 'Solo puedes gestionar reparaciones de tu sucursal');
  }

  if (technicianId !== null) {
    await validateTechnicianForBranch(technicianId, repair.branchId);
  }

  const [updated] = await db
    .update(devices)
    .set({ technicianId, updatedAt: new Date() })
    .where(eq(devices.id, repairId))
    .returning();

  return {
    updated,
    previousTechnicianId: repair.technicianId,
  };
}

export async function updateRepairStatus(repairId: number, newStatus: string, user: RequestUser) {
  const allowedStatuses = [...PENDING_STATUSES, ...COMPLETED_STATUSES];
  if (!allowedStatuses.includes(newStatus)) {
    throw new HttpError(400, `Estado inválido: ${newStatus}`);
  }

  const repair = await getRepairById(repairId);

  if (user.branchId && repair.branchId !== user.branchId && user.role !== 'administrador_general') {
    throw new HttpError(403, 'Solo puedes actualizar reparaciones de tu sucursal');
  }

  const isDelivered = newStatus === 'Entregado';
  const deliveredAt = isDelivered ? new Date() : repair.deliveredAt ?? undefined;

  const [updated] = await db
    .update(devices)
    .set({
      internalStatus: newStatus as any,
      deliveredAt: isDelivered ? new Date() : (repair.deliveredAt ?? undefined),
      updatedAt: new Date(),
    })
    .where(eq(devices.id, repairId))
    .returning();

  return updated;
}
