import { and, asc, eq, sql } from 'drizzle-orm';
import { assertBranchAccess } from '../../middlewares/branch-access-middleware.js';
import { db } from '../../db/client.js';
import { customers, devices, sales } from '../../db/schema.js';
import { HttpError } from '../../utils/http-error.js';
import { parsePagination } from '../../utils/pagination.js';

interface AuthContext {
  id: number;
  role: string;
  branchId: number | null;
}

function sanitize(record: typeof customers.$inferSelect) {
  return {
    id: record.id,
    full_name: record.fullName,
    phone: record.phone,
    national_id: record.nationalId,
    address: record.address,
    email: record.email,
    branch_id: record.branchId,
    alert_note: record.alertNote,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function resolveTargetBranch(user: AuthContext, explicitBranchId?: number) {
  if (user.role === 'administrador_general') {
    if (!explicitBranchId) throw new HttpError(400, 'branch_id es requerido para administrador_general');
    return explicitBranchId;
  }

  if (!user.branchId) throw new HttpError(403, 'Usuario sin sucursal asignada');
  if (explicitBranchId && explicitBranchId !== user.branchId) throw new HttpError(403, 'No puedes crear clientes en otra sucursal');
  return user.branchId;
}

export async function listCustomers(query: Record<string, unknown>, user: AuthContext) {
  const { page, limit, offset } = parsePagination(query);
  const search = typeof query.search === 'string' ? query.search : undefined;
  const branchFilter = query.branch_id ? Number(query.branch_id) : undefined;

  const filters = [];
  if (search) {
    filters.push(sql`${customers.fullName} ILIKE ${`%${search}%`} OR ${customers.phone} ILIKE ${`%${search}%`}`);
  }

  if (user.role !== 'administrador_general') {
    if (!user.branchId) throw new HttpError(403, 'Usuario sin sucursal asignada');
    filters.push(eq(customers.branchId, user.branchId));
  } else if (branchFilter) {
    filters.push(eq(customers.branchId, branchFilter));
  }

  const where = filters.length ? and(...filters) : undefined;

  const rows = await db.select().from(customers).where(where).orderBy(asc(customers.fullName)).limit(limit).offset(offset);
  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(customers).where(where);

  return {
    data: rows.map(sanitize),
    meta: { page, limit, total: Number(totalResult[0]?.count ?? 0) },
  };
}

export async function createCustomer(
  input: {
    full_name: string;
    phone: string;
    national_id?: string | null;
    address?: string | null;
    email?: string | null;
    alert_note?: string | null;
    branch_id?: number;
  },
  user: AuthContext,
) {
  const targetBranchId = resolveTargetBranch(user, input.branch_id);

  const [created] = await db
    .insert(customers)
    .values({
      fullName: input.full_name,
      phone: input.phone,
      nationalId: input.national_id ?? null,
      address: input.address ?? null,
      email: input.email ?? null,
      branchId: targetBranchId,
      alertNote: input.alert_note ?? null,
    })
    .returning();

  return sanitize(created);
}

export async function getCustomerDetail(id: number, user: AuthContext) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) throw new HttpError(404, 'Cliente no encontrado');

  assertBranchAccess(user.role, user.branchId ? String(user.branchId) : null, customer.branchId);

  const repairsAgg = await db
    .select({ total: sql<number>`count(*)`, lastDate: sql<string | null>`max(${devices.createdAt})::text` })
    .from(devices)
    .where(and(eq(devices.customerId, id), eq(devices.branchId, customer.branchId)));

  const salesAgg = await db
    .select({ total: sql<number>`count(*)`, lastDate: sql<string | null>`max(${sales.createdAt})::text` })
    .from(sales)
    .where(and(eq(sales.customerId, id), eq(sales.branchId, customer.branchId)));

  return {
    ...sanitize(customer),
    summary: {
      total_repairs: Number(repairsAgg[0]?.total ?? 0),
      total_sales: Number(salesAgg[0]?.total ?? 0),
      last_repair_at: repairsAgg[0]?.lastDate ?? null,
      last_sale_at: salesAgg[0]?.lastDate ?? null,
    },
  };
}

export async function updateCustomer(
  id: number,
  input: Partial<{ full_name: string; phone: string; national_id: string | null; address: string | null; email: string | null; alert_note: string | null; branch_id: number }>,
  user: AuthContext,
) {
  const [existing] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!existing) throw new HttpError(404, 'Cliente no encontrado');

  assertBranchAccess(user.role, user.branchId ? String(user.branchId) : null, existing.branchId);

  const targetBranchId = input.branch_id ? resolveTargetBranch(user, input.branch_id) : existing.branchId;

  const [updated] = await db
    .update(customers)
    .set({
      fullName: input.full_name,
      phone: input.phone,
      nationalId: input.national_id,
      address: input.address,
      email: input.email,
      branchId: targetBranchId,
      alertNote: input.alert_note,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id))
    .returning();

  return sanitize(updated);
}
