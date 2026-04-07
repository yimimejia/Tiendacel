import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { branches, subscriptionPayments, subscriptions } from '../../db/schema.js';
import { HttpError } from '../../utils/http-error.js';

function getPaymentStatus(nextDueDateStr: string): 'rojo' | 'amarillo' | 'verde' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDateStr);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'rojo';
  if (diffDays <= 5) return 'amarillo';
  return 'verde';
}

export async function listSubscriptions() {
  const allBranches = await db
    .select({
      id: branches.id,
      name: branches.name,
      code: branches.code,
      isActive: branches.isActive,
      subId: subscriptions.id,
      monthlyFee: subscriptions.monthlyFee,
      paymentDay: subscriptions.paymentDay,
      nextDueDate: subscriptions.nextDueDate,
      notes: subscriptions.notes,
    })
    .from(branches)
    .leftJoin(subscriptions, eq(subscriptions.branchId, branches.id))
    .where(eq(branches.isActive, true))
    .orderBy(asc(branches.name));

  return allBranches.map((r) => ({
    id: r.subId ?? 0,
    branchId: r.id,
    branchName: r.name,
    branchCode: r.code,
    branchIsActive: r.isActive,
    monthlyFee: r.monthlyFee ?? '0',
    paymentDay: r.paymentDay ?? 1,
    nextDueDate: r.nextDueDate ?? null,
    notes: r.notes ?? null,
    status: r.nextDueDate ? getPaymentStatus(r.nextDueDate) : ('sin_configurar' as const),
  }));
}

export async function getSubscriptionByBranch(branchId: number) {
  const [row] = await db
    .select({
      id: subscriptions.id,
      branchId: subscriptions.branchId,
      branchName: branches.name,
      monthlyFee: subscriptions.monthlyFee,
      paymentDay: subscriptions.paymentDay,
      nextDueDate: subscriptions.nextDueDate,
      notes: subscriptions.notes,
    })
    .from(subscriptions)
    .innerJoin(branches, eq(subscriptions.branchId, branches.id))
    .where(eq(subscriptions.branchId, branchId))
    .limit(1);

  if (!row) throw new HttpError(404, 'Suscripción no encontrada para esta sucursal');
  return { ...row, status: getPaymentStatus(row.nextDueDate) };
}

export async function getPaymentHistory(branchId: number) {
  const sub = await getSubscriptionByBranch(branchId);

  const payments = await db
    .select()
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.branchId, branchId))
    .orderBy(desc(subscriptionPayments.paidAt));

  return { subscription: sub, payments };
}

export async function createOrUpdateSubscription(input: {
  branch_id: number;
  monthly_fee: number;
  payment_day: number;
  next_due_date: string;
  notes?: string | null;
}) {
  const [branch] = await db.select({ id: branches.id }).from(branches).where(eq(branches.id, input.branch_id)).limit(1);
  if (!branch) throw new HttpError(404, 'Sucursal no encontrada');

  const [existing] = await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.branchId, input.branch_id)).limit(1);

  if (existing) {
    const [updated] = await db
      .update(subscriptions)
      .set({
        monthlyFee: String(input.monthly_fee),
        paymentDay: input.payment_day,
        nextDueDate: input.next_due_date,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id))
      .returning();
    return { ...updated, status: getPaymentStatus(updated.nextDueDate) };
  }

  const [created] = await db
    .insert(subscriptions)
    .values({
      branchId: input.branch_id,
      monthlyFee: String(input.monthly_fee),
      paymentDay: input.payment_day,
      nextDueDate: input.next_due_date,
      notes: input.notes ?? null,
    })
    .returning();

  return { ...created, status: getPaymentStatus(created.nextDueDate) };
}

export async function recordPayment(input: {
  branch_id: number;
  amount: number;
  payment_method: 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';
  note?: string | null;
  recorded_by_user_id: number;
  advance_due_date?: boolean;
}) {
  const sub = await getSubscriptionByBranch(input.branch_id);

  const [payment] = await db
    .insert(subscriptionPayments)
    .values({
      subscriptionId: sub.id,
      branchId: input.branch_id,
      amount: String(input.amount),
      paymentMethod: input.payment_method,
      note: input.note ?? null,
      recordedByUserId: input.recorded_by_user_id,
    })
    .returning();

  if (input.advance_due_date !== false) {
    const current = new Date(sub.nextDueDate);
    current.setMonth(current.getMonth() + 1);
    const newDue = current.toISOString().split('T')[0];
    await db.update(subscriptions).set({ nextDueDate: newDue, updatedAt: new Date() }).where(eq(subscriptions.id, sub.id));
  }

  return payment;
}

export async function deletePayment(paymentId: number) {
  const [deleted] = await db.delete(subscriptionPayments).where(eq(subscriptionPayments.id, paymentId)).returning();
  if (!deleted) throw new HttpError(404, 'Pago no encontrado');
  return deleted;
}
