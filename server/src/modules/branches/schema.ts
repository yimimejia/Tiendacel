import { z } from 'zod';

export const branchIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const createBranchSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(25),
  address: z.string().min(3),
  phone: z.string().min(5),
  manager_name: z.string().max(140).nullable().optional(),
});

export const updateBranchSchema = createBranchSchema.partial();

export const toggleBranchSchema = z.object({
  is_active: z.boolean(),
});
