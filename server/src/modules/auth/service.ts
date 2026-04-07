import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { branches, roles, users } from '../../db/schema.js';
import { HttpError } from '../../utils/http-error.js';

export async function login(usernameOrEmail: string, password: string) {
  const [record] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      usernameOrEmail: users.usernameOrEmail,
      passwordHash: users.passwordHash,
      branchId: users.branchId,
      branchName: branches.name,
      isActive: users.isActive,
      role: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(branches, eq(users.branchId, branches.id))
    .where(eq(users.usernameOrEmail, usernameOrEmail))
    .limit(1);

  if (!record) throw new HttpError(401, 'Credenciales inválidas');
  if (!record.isActive) throw new HttpError(403, 'Usuario inactivo');

  const isValidPassword = await bcrypt.compare(password, record.passwordHash);
  if (!isValidPassword) throw new HttpError(401, 'Credenciales inválidas');

  const token = jwt.sign({ userId: record.id }, env.JWT_SECRET, { expiresIn: '8h' });

  return {
    token,
    user: {
      id: record.id,
      full_name: record.fullName,
      role: record.role,
      branch_id: record.branchId,
      branch_name: record.branchName ?? null,
      username_or_email: record.usernameOrEmail,
    },
  };
}

export async function getMe(userId: number) {
  const [record] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      usernameOrEmail: users.usernameOrEmail,
      branchId: users.branchId,
      branchName: branches.name,
      role: roles.name,
      isActive: users.isActive,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(branches, eq(users.branchId, branches.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!record || !record.isActive) throw new HttpError(401, 'Usuario no disponible');

  return {
    id: record.id,
    full_name: record.fullName,
    role: record.role,
    branch_id: record.branchId,
    branch_name: record.branchName ?? null,
    username_or_email: record.usernameOrEmail,
  };
}
