import bcrypt from 'bcryptjs';
import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { roles, users } from '../../db/schema.js';
import { HttpError } from '../../utils/http-error.js';
import { parsePagination } from '../../utils/pagination.js';

function sanitizeUser(record: {
  id: number;
  fullName: string;
  usernameOrEmail: string;
  roleId: number;
  roleName: string;
  branchId: number | null;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: record.id,
    full_name: record.fullName,
    username_or_email: record.usernameOrEmail,
    role_id: record.roleId,
    role_name: record.roleName,
    branch_id: record.branchId,
    is_active: record.isActive,
    created_at: record.createdAt,
  };
}

export async function listUsers(query: Record<string, unknown>) {
  const { page, limit, offset } = parsePagination(query);
  const search = typeof query.search === 'string' ? query.search : undefined;
  const roleId = query.role_id ? Number(query.role_id) : undefined;
  const branchId = query.branch_id ? Number(query.branch_id) : undefined;
  const isActive = query.is_active !== undefined ? String(query.is_active) === 'true' : undefined;

  const filters = [];

  if (search) {
    filters.push(sql`${users.fullName} ILIKE ${`%${search}%`} OR ${users.usernameOrEmail} ILIKE ${`%${search}%`}`);
  }

  if (roleId) filters.push(eq(users.roleId, roleId));
  if (branchId) filters.push(eq(users.branchId, branchId));
  if (typeof isActive === 'boolean') filters.push(eq(users.isActive, isActive));

  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      usernameOrEmail: users.usernameOrEmail,
      roleId: users.roleId,
      roleName: roles.name,
      branchId: users.branchId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(where)
    .orderBy(asc(users.fullName))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(users).where(where);

  return { data: rows.map(sanitizeUser), meta: { page, limit, total: Number(totalResult[0]?.count ?? 0) } };
}

export async function getUserById(id: number) {
  const [row] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      usernameOrEmail: users.usernameOrEmail,
      roleId: users.roleId,
      roleName: roles.name,
      branchId: users.branchId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, id))
    .limit(1);

  if (!row) throw new HttpError(404, 'Usuario no encontrado');
  return sanitizeUser(row);
}

async function validateRoleAndBranch(roleId: number, branchId: number | null | undefined) {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) throw new HttpError(400, 'role_id inválido');

  if (role.name !== 'administrador_general' && !branchId) {
    throw new HttpError(400, 'branch_id es requerido para roles distintos a administrador_general');
  }
}

export async function createUser(input: {
  full_name: string;
  username_or_email: string;
  password: string;
  role_id: number;
  branch_id?: number | null;
  is_active?: boolean;
}) {
  await validateRoleAndBranch(input.role_id, input.branch_id);

  const [exists] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.usernameOrEmail, input.username_or_email))
    .limit(1);

  if (exists) throw new HttpError(409, 'username_or_email ya existe');

  const passwordHash = await bcrypt.hash(input.password, 10);

  const [created] = await db
    .insert(users)
    .values({
      fullName: input.full_name,
      usernameOrEmail: input.username_or_email,
      passwordHash,
      roleId: input.role_id,
      branchId: input.branch_id ?? null,
      isActive: input.is_active ?? true,
    })
    .returning();

  return getUserById(created.id);
}

export async function updateUser(id: number, input: Partial<{ full_name: string; username_or_email: string; role_id: number; branch_id: number | null; is_active: boolean }>) {
  if (input.role_id) {
    await validateRoleAndBranch(input.role_id, input.branch_id);
  }

  if (input.username_or_email) {
    const [exists] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.usernameOrEmail, input.username_or_email), sql`${users.id} <> ${id}`))
      .limit(1);
    if (exists) throw new HttpError(409, 'username_or_email ya existe');
  }

  const [updated] = await db
    .update(users)
    .set({
      fullName: input.full_name,
      usernameOrEmail: input.username_or_email,
      roleId: input.role_id,
      branchId: input.branch_id,
      isActive: input.is_active,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (!updated) throw new HttpError(404, 'Usuario no encontrado');
  return getUserById(updated.id);
}

export async function resetPassword(id: number, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);

  const [updated] = await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  if (!updated) throw new HttpError(404, 'Usuario no encontrado');
}

export async function toggleUserStatus(id: number, isActive: boolean) {
  const [updated] = await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  if (!updated) throw new HttpError(404, 'Usuario no encontrado');
  return getUserById(updated.id);
}
