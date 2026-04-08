import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { devices, roles, users } from '../../db/schema.js';
import { HttpError } from '../../utils/http-error.js';

interface RequestUser {
  id: number;
  role: string;
  branchId: number | null;
}

function toRepairResponse(record: {
  id: number;
  deviceNumber: string;
  branchId: number;
  customerId: number;
  model: string;
  brand: string;
  internalStatus: string;
  technicianId: number | null;
  technicianName: string | null;
  receivedAt: Date;
}) {
  return {
    id: record.id,
    repair_number: record.deviceNumber,
    branch_id: record.branchId,
    customer_id: record.customerId,
    brand: record.brand,
    model: record.model,
    internal_status: record.internalStatus,
    technician_id: record.technicianId,
    technician_name: record.technicianName,
    assignment_status: record.technicianId ? 'asignado' : 'sin_asignar',
    received_at: record.receivedAt,
  };
}

export async function listRepairsForUser(user: RequestUser) {
  const joins = db
    .select({
      id: devices.id,
      deviceNumber: devices.deviceNumber,
      branchId: devices.branchId,
      customerId: devices.customerId,
      model: devices.model,
      brand: devices.brand,
      internalStatus: devices.internalStatus,
      technicianId: devices.technicianId,
      technicianName: users.fullName,
      receivedAt: devices.receivedAt,
    })
    .from(devices)
    .leftJoin(users, eq(devices.technicianId, users.id));

  if (user.role === 'administrador_general') {
    const rows = await joins.orderBy(asc(devices.receivedAt));
    return rows.map(toRepairResponse);
  }

  if (!user.branchId) {
    throw new HttpError(403, 'Usuario sin sucursal asignada.');
  }

  if (user.role === 'encargado_sucursal') {
    const rows = await joins.where(eq(devices.branchId, user.branchId)).orderBy(asc(devices.receivedAt));
    return rows.map(toRepairResponse);
  }

  if (user.role === 'tecnico') {
    const rows = await joins
      .where(and(eq(devices.branchId, user.branchId), or(eq(devices.technicianId, user.id), isNull(devices.technicianId))))
      .orderBy(asc(devices.receivedAt));
    return rows.map(toRepairResponse);
  }

  throw new HttpError(403, 'No autorizado para ver reparaciones.');
}

export async function getAssignableTechnicians(branchId: number) {
  const rows = await db
    .select({ id: users.id, fullName: users.fullName, branchId: users.branchId, roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.isActive, true), eq(users.branchId, branchId), inArray(roles.name, ['tecnico', 'encargado_sucursal', 'caja_ventas', 'administrador_general'])));

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
    throw new HttpError(400, 'El técnico debe pertenecer a la misma sucursal de la reparación');
  }

  if (!['tecnico', 'encargado_sucursal', 'caja_ventas', 'administrador_general'].includes(employee.roleName)) {
    throw new HttpError(400, 'El usuario seleccionado no puede recibir reparaciones');
  }

  return employee;
}

export async function takeRepairWork(repairId: number, user: RequestUser) {
  if (user.role !== 'tecnico') {
    throw new HttpError(403, 'Solo técnicos pueden tomar trabajo');
  }

  const repair = await getRepairById(repairId);

  if (!user.branchId || repair.branchId !== user.branchId) {
    throw new HttpError(403, 'Solo puedes tomar trabajos sin asignar de tu sucursal');
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
