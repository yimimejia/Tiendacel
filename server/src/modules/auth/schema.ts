import { z } from 'zod';

export const loginSchema = z.object({
  username_or_email: z.string().min(3),
  password: z.string().min(6),
  branch_code: z.string().min(1).max(25).optional(),
});
