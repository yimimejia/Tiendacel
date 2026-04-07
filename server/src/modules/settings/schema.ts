import { z } from 'zod';

export const upsertSettingSchema = z.object({
  key: z.string().min(2),
  value: z.string().min(1),
  description: z.string().optional(),
});
