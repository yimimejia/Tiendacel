import { z } from 'zod';

export const repairIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const assignRepairSchema = z.object({
  technician_id: z.coerce.number().int().positive().nullable(),
});

export const createRepairSchema = z.object({
  customer_name: z.string().min(1, 'El nombre del cliente es requerido'),
  customer_phone: z.string().min(1, 'El teléfono es requerido'),
  contact_phone: z.string().optional().nullable(),
  brand: z.string().min(1, 'La marca es requerida'),
  model: z.string().min(1, 'El modelo es requerido'),
  issue: z.string().min(1, 'El problema reportado es requerido'),
  requires_evaluation: z.boolean().optional().default(false),
  total: z.number().nonnegative().optional().default(0),
  advance: z.number().nonnegative().optional().default(0),
  assigned_to: z.coerce.number().int().positive().optional().nullable(),
  branch_id: z.coerce.number().int().positive().optional(),
});
