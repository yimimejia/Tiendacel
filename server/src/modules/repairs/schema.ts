import { z } from 'zod';

export const repairIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const assignRepairSchema = z.object({
  technician_id: z.coerce.number().int().positive().nullable(),
});
