import bcrypt from 'bcryptjs';
import { and, asc, eq, ilike, isNull, sql } from 'drizzle-orm';
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

interface AuthContext {
  id: number;
  role: string;
  branchId: number | null;
}

function resolveTargetBranch(user: AuthContext, explicitBranchId?: number | null) {
  if (user.role === 'admin_supremo') return explicitBranchId ?? null;
  if (user.role === 'administrador_general') {
    return explicitBranchId ?? user.branchId ?? null;
  }
  return user.branchId;
}

function buildScopedFilters(user: AuthContext, explicitBranchId?: number) {
  if (user.role === 'admin_supremo') {
    return explicitBranchId ? [eq(users.branchId, explicitBranchId)] : [];
  }
  if (user.role === 'administrador_general') {
    if (!user.branchId) return explicitBranchId ? [eq(users.branchId, explicitBranchId)] : [];
    if (explicitBranchId && explicitBranchId !== user.branchId) {
      throw new HttpError(403, 'No puedes consultar usuarios de otra sucursal');
    }
    return [eq(users.branchId, user.branchId)];
  }
  if (!user.branchId) throw new HttpError(403, 'Usuario sin sucursal asignada');
  if (explicitBranchId && explicitBranchId !== user.branchId) {
    throw new HttpError(403, 'No puedes consultar usuarios de otra sucursal');
  }
  return [eq(users.branchId, user.branchId)];
}

function assertCanAccessUserBranch(user: AuthContext, targetBranchId: number | null) {
  if (user.role === 'admin_supremo') return;
  if (user.role === 'administrador_general' && user.branchId === null) return;
  if (!user.branchId || targetBranchId !== user.branchId) {
    throw new HttpError(403, 'No puedes consultar usuarios de otra sucursal');
  }
}

async function findUserByUsernameInBranch(usernameOrEmail: string, branchId: number | null, excludeId?: number) {
  const conditions = [eq(users.usernameOrEmail, usernameOrEmail)];
  if (branchId === null) {
    conditions.push(isNull(users.branchId));
  } else {
    conditions.push(eq(users.branchId, branchId));
  }

  if (excludeId) {
    conditions.push(sql`${users.id} <> ${excludeId}`);
  }

  const [exists] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(...conditions))
    .limit(1);

  return exists;
}

export async function listUsers(query: Record<string, unknown>, user: AuthContext) {
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
  filters.push(...buildScopedFilters(user, branchId));

  const where = filters.length === 0 ? undefined : (filters.length === 1 ? filters[0] : and(...filters));

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

export async function getUserById(id: number, user: AuthContext) {
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
  assertCanAccessUserBranch(user, row.branchId);
  return sanitizeUser(row);
}

const GLOBAL_ROLES = ['administrador_general', 'admin_supremo'];
const BRANCH_MANAGED_ROLES = ['encargado_sucursal', 'tecnico', 'caja_ventas'];

async function validateRoleAndBranch(roleId: number, branchId: number | null | undefined, actorRole: string) {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) throw new HttpError(400, 'role_id inválido');

  if (!GLOBAL_ROLES.includes(role.name) && !branchId) {
    throw new HttpError(400, 'branch_id es requerido para este rol');
  }

  if (actorRole !== 'admin_supremo' && !BRANCH_MANAGED_ROLES.includes(role.name)) {
    throw new HttpError(403, 'No puedes asignar este rol');
  }

  return role;
}

export async function createUser(input: {
  full_name: string;
  username_or_email: string;
  password: string;
  role_id: number;
  branch_id?: number | null;
  is_active?: boolean;
}, user: AuthContext) {
  const targetBranchId = resolveTargetBranch(user, input.branch_id);
  await validateRoleAndBranch(input.role_id, targetBranchId, user.role);

  const exists = await findUserByUsernameInBranch(input.username_or_email, targetBranchId);
  if (exists) throw new HttpError(409, 'username_or_email ya existe en esta sucursal');

  const passwordHash = await bcrypt.hash(input.password, 10);

  const [created] = await db
    .insert(users)
    .values({
      fullName: input.full_name,
      usernameOrEmail: input.username_or_email,
      passwordHash,
      roleId: input.role_id,
      branchId: targetBranchId,
      isActive: input.is_active ?? true,
    })
    .returning();

  return getUserById(created.id, user);
}

export async function updateUser(
  id: number,
  input: Partial<{ full_name: string; username_or_email: string; role_id: number; branch_id: number | null; is_active: boolean }>,
  user: AuthContext,
) {
  const current = await getUserById(id, user);
  const targetBranchId = resolveTargetBranch(user, input.branch_id ?? current.branch_id);

  if (input.role_id) {
    await validateRoleAndBranch(input.role_id, targetBranchId, user.role);
  }

  if (input.username_or_email) {
    const exists = await findUserByUsernameInBranch(input.username_or_email, targetBranchId, id);
    if (exists) throw new HttpError(409, 'username_or_email ya existe en esta sucursal');
  }

  const [updated] = await db
    .update(users)
    .set({
      fullName: input.full_name,
      usernameOrEmail: input.username_or_email,
      roleId: input.role_id,
      branchId: targetBranchId,
      isActive: input.is_active,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (!updated) throw new HttpError(404, 'Usuario no encontrado');
  return getUserById(updated.id, user);
}

export async function resetPassword(id: number, password: string, user: AuthContext) {
  await getUserById(id, user);
  const passwordHash = await bcrypt.hash(password, 10);

  const [updated] = await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  if (!updated) throw new HttpError(404, 'Usuario no encontrado');
}

export async function toggleUserStatus(id: number, isActive: boolean, user: AuthContext) {
  await getUserById(id, user);
  const [updated] = await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, id)).returning();
  if (!updated) throw new HttpError(404, 'Usuario no encontrado');
  return getUserById(updated.id, user);
}
