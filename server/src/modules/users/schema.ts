import { z } from 'zod';

export const userIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const createUserSchema = z.object({
  full_name: z.string().min(2),
  username_or_email: z.string().min(3),
  password: z.string().min(8),
  role_id: z.number().int().positive(),
  branch_id: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const updateUserSchema = createUserSchema.omit({ password: true }).partial();

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

export const toggleUserSchema = z.object({
  is_active: z.boolean(),
});
