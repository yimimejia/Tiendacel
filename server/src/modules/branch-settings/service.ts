import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { branchSettings } from '../../db/schema.js';
import { HttpError } from '../../utils/http-error.js';

function sanitize(row: typeof branchSettings.$inferSelect) {
  return {
    id: row.id,
    branch_id: row.branchId,
    business_name: row.businessName,
    logo_url: row.logoUrl,
    address: row.address,
    phone: row.phone,
    email: row.email,
    rnc: row.rnc,
    fiscal_name: row.fiscalName,
    receipt_footer: row.receiptFooter,
    invoice_footer: row.invoiceFooter,
    warranty_days_default: row.warrantyDaysDefault,
    block_delivery_with_balance: row.blockDeliveryWithBalance,
    feature_flags: row.featureFlags,
    updated_at: row.updatedAt,
  };
}

export async function getBranchSettings(branchId: number) {
  const [existing] = await db.select().from(branchSettings).where(eq(branchSettings.branchId, branchId)).limit(1);
  if (!existing) throw new HttpError(404, 'La sucursal no tiene configuración aún');
  return sanitize(existing);
}

export async function upsertBranchSettings(branchId: number, input: Record<string, unknown>) {
  const [existing] = await db.select().from(branchSettings).where(eq(branchSettings.branchId, branchId)).limit(1);

  if (!existing) {
    const [created] = await db
      .insert(branchSettings)
      .values({
        branchId,
        businessName: (input.business_name as string | null | undefined) ?? null,
        logoUrl: (input.logo_url as string | null | undefined) ?? null,
        address: (input.address as string | null | undefined) ?? null,
        phone: (input.phone as string | null | undefined) ?? null,
        email: (input.email as string | null | undefined) ?? null,
        rnc: (input.rnc as string | null | undefined) ?? null,
        fiscalName: (input.fiscal_name as string | null | undefined) ?? null,
        receiptFooter: (input.receipt_footer as string | null | undefined) ?? null,
        invoiceFooter: (input.invoice_footer as string | null | undefined) ?? null,
        warrantyDaysDefault: (input.warranty_days_default as number | undefined) ?? 30,
        blockDeliveryWithBalance: (input.block_delivery_with_balance as boolean | undefined) ?? false,
        featureFlags: (input.feature_flags as Record<string, unknown> | undefined) ?? {},
      })
      .returning();

    return sanitize(created);
  }

  const [updated] = await db
    .update(branchSettings)
    .set({
      businessName: (input.business_name as string | null | undefined) ?? existing.businessName,
      logoUrl: (input.logo_url as string | null | undefined) ?? existing.logoUrl,
      address: (input.address as string | null | undefined) ?? existing.address,
      phone: (input.phone as string | null | undefined) ?? existing.phone,
      email: (input.email as string | null | undefined) ?? existing.email,
      rnc: (input.rnc as string | null | undefined) ?? existing.rnc,
      fiscalName: (input.fiscal_name as string | null | undefined) ?? existing.fiscalName,
      receiptFooter: (input.receipt_footer as string | null | undefined) ?? existing.receiptFooter,
      invoiceFooter: (input.invoice_footer as string | null | undefined) ?? existing.invoiceFooter,
      warrantyDaysDefault: (input.warranty_days_default as number | undefined) ?? existing.warrantyDaysDefault,
      blockDeliveryWithBalance: (input.block_delivery_with_balance as boolean | undefined) ?? existing.blockDeliveryWithBalance,
      featureFlags: (input.feature_flags as Record<string, unknown> | undefined) ?? existing.featureFlags,
      updatedAt: new Date(),
    })
    .where(eq(branchSettings.branchId, branchId))
    .returning();

  return sanitize(updated);
}
