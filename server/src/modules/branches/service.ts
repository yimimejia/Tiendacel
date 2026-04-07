import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { branches } from '../../db/schema.js';
import { HttpError } from '../../utils/http-error.js';
import { parsePagination } from '../../utils/pagination.js';

export async function listBranches(query: Record<string, unknown>, forcedBranchId?: number | null) {
  const { page, limit, offset } = parsePagination(query);
  const search = typeof query.search === 'string' ? query.search : undefined;
  const includeInactive = String(query.include_inactive ?? 'false') === 'true';

  const filters = [];
  if (!includeInactive) filters.push(eq(branches.isActive, true));
  if (search) filters.push(ilike(branches.name, `%${search}%`));
  if (forcedBranchId) filters.push(eq(branches.id, forcedBranchId));

  const where = filters.length ? and(...filters) : undefined;

  const data = await db.select().from(branches).where(where).orderBy(asc(branches.name)).limit(limit).offset(offset);
  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(branches).where(where);

  return { data, meta: { page, limit, total: Number(totalResult[0]?.count ?? 0) } };
}

export async function getBranchById(id: number) {
  const [branch] = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  if (!branch) throw new HttpError(404, 'Sucursal no encontrada');
  return branch;
}

export async function createBranch(input: {
  name: string;
  code: string;
  address: string;
  phone: string;
  manager_name?: string | null;
}) {
  const [exists] = await db.select({ id: branches.id }).from(branches).where(eq(branches.code, input.code)).limit(1);
  if (exists) throw new HttpError(409, 'El código de sucursal ya existe');

  const [created] = await db
    .insert(branches)
    .values({
      name: input.name,
      code: input.code,
      address: input.address,
      phone: input.phone,
      managerName: input.manager_name ?? null,
      isActive: true,
    })
    .returning();

  return created;
}

export async function updateBranch(id: number, input: Partial<{ name: string; code: string; address: string; phone: string; manager_name: string | null }>) {
  if (input.code) {
    const [exists] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.code, input.code), sql`${branches.id} <> ${id}`))
      .limit(1);
    if (exists) throw new HttpError(409, 'El código de sucursal ya existe');
  }

  const [updated] = await db
    .update(branches)
    .set({
      name: input.name,
      code: input.code,
      address: input.address,
      phone: input.phone,
      managerName: input.manager_name,
      updatedAt: new Date(),
    })
    .where(eq(branches.id, id))
    .returning();

  if (!updated) throw new HttpError(404, 'Sucursal no encontrada');
  return updated;
}

export async function toggleBranchStatus(id: number, isActive: boolean) {
  const [updated] = await db
    .update(branches)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(branches.id, id))
    .returning();
  if (!updated) throw new HttpError(404, 'Sucursal no encontrada');
  return updated;
}
