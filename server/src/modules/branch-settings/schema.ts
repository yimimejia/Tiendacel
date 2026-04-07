import { z } from 'zod';

export const upsertBranchSettingsSchema = z.object({
  branch_id: z.coerce.number().int().positive().optional(),
  business_name: z.string().max(180).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  rnc: z.string().max(40).nullable().optional(),
  fiscal_name: z.string().max(180).nullable().optional(),
  receipt_footer: z.string().nullable().optional(),
  invoice_footer: z.string().nullable().optional(),
  warranty_days_default: z.coerce.number().int().nonnegative().optional(),
  block_delivery_with_balance: z.boolean().optional(),
  feature_flags: z.record(z.any()).optional(),
});
