import { z } from 'zod';

export const customerIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const createCustomerSchema = z.object({
  full_name: z.string().min(2),
  phone: z.string().min(5),
  national_id: z.string().max(40).nullable().optional(),
  address: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  alert_note: z.string().nullable().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();
