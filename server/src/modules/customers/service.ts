import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { customers, devices, sales } from '../../db/schema.js';
import { HttpError } from '../../utils/http-error.js';
import { parsePagination } from '../../utils/pagination.js';

function sanitize(record: typeof customers.$inferSelect) {
  return {
    id: record.id,
    full_name: record.fullName,
    phone: record.phone,
    national_id: record.nationalId,
    address: record.address,
    email: record.email,
    alert_note: record.alertNote,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export async function listCustomers(query: Record<string, unknown>) {
  const { page, limit, offset } = parsePagination(query);
  const search = typeof query.search === 'string' ? query.search : undefined;

  const filters = [];
  if (search) {
    filters.push(sql`${customers.fullName} ILIKE ${`%${search}%`} OR ${customers.phone} ILIKE ${`%${search}%`}`);
  }

  const where = filters.length ? and(...filters) : undefined;

  const rows = await db.select().from(customers).where(where).orderBy(asc(customers.fullName)).limit(limit).offset(offset);
  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(customers).where(where);

  return {
    data: rows.map(sanitize),
    meta: { page, limit, total: Number(totalResult[0]?.count ?? 0) },
  };
}

export async function createCustomer(input: {
  full_name: string;
  phone: string;
  national_id?: string | null;
  address?: string | null;
  email?: string | null;
  alert_note?: string | null;
}) {
  const [created] = await db
    .insert(customers)
    .values({
      fullName: input.full_name,
      phone: input.phone,
      nationalId: input.national_id ?? null,
      address: input.address ?? null,
      email: input.email ?? null,
      alertNote: input.alert_note ?? null,
    })
    .returning();

  return sanitize(created);
}

export async function getCustomerDetail(id: number) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) throw new HttpError(404, 'Cliente no encontrado');

  const repairsAgg = await db
    .select({ total: sql<number>`count(*)`, lastDate: sql<string | null>`max(${devices.createdAt})::text` })
    .from(devices)
    .where(eq(devices.customerId, id));

  const salesAgg = await db
    .select({ total: sql<number>`count(*)`, lastDate: sql<string | null>`max(${sales.createdAt})::text` })
    .from(sales)
    .where(eq(sales.customerId, id));

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
  input: Partial<{ full_name: string; phone: string; national_id: string | null; address: string | null; email: string | null; alert_note: string | null }>,
) {
  const [updated] = await db
    .update(customers)
    .set({
      fullName: input.full_name,
      phone: input.phone,
      nationalId: input.national_id,
      address: input.address,
      email: input.email,
      alertNote: input.alert_note,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id))
    .returning();

  if (!updated) throw new HttpError(404, 'Cliente no encontrado');
  return sanitize(updated);
}
