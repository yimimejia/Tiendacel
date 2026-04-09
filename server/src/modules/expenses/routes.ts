import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { HttpError } from '../../utils/http-error.js';

const router = Router();
router.use(authMiddleware);

const ALLOWED_ROLES = ['administrador_general', 'encargado_sucursal', 'admin_supremo', 'caja_ventas'];

router.get('/', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const canOverride = ['admin_supremo', 'administrador_general'].includes(user?.role);
  const overrideBranch = canOverride && req.query.branch_id ? Number(req.query.branch_id) : null;
  const branchId: number | null = overrideBranch ?? user?.branchId ?? null;
  const days = Math.min(parseInt((req.query.days as string) ?? '30'), 365);

  const condition = branchId
    ? sql`AND e.branch_id = ${branchId}`
    : sql``;

  const rows = await db.execute<{
    id: number; amount: string; category: string; description: string;
    payment_method: string; reference: string | null; from_cash: boolean; created_at: string;
    creator_name: string;
  }>(sql`
    SELECT e.id, e.amount, e.category, e.description, e.payment_method,
           e.reference, e.from_cash, e.created_at,
           COALESCE(u.full_name, 'Sistema') AS creator_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.created_by_user_id
    WHERE e.created_at >= NOW() - (${days} || ' days')::INTERVAL
    ${condition}
    ORDER BY e.created_at DESC
    LIMIT 500
  `);

  res.json({ success: true, data: rows.rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!ALLOWED_ROLES.includes(user?.role)) throw new HttpError(403, 'No autorizado para registrar gastos');
  if (!user?.branchId) throw new HttpError(400, 'No tienes sucursal asignada');

  const { amount, category, description, payment_method, reference, from_cash } = req.body ?? {};
  if (!amount || !description) throw new HttpError(400, 'El monto y la descripción son obligatorios');
  if (Number(amount) <= 0) throw new HttpError(400, 'El monto debe ser mayor a 0');

  const fromCashVal = from_cash === true || from_cash === 'true';

  const rows = await db.execute<{ id: number }>(sql`
    INSERT INTO expenses (branch_id, created_by_user_id, amount, category, description, payment_method, reference, from_cash)
    VALUES (${user.branchId}, ${user.id}, ${Number(amount)}, ${category ?? 'general'}, ${description}, ${payment_method ?? 'efectivo'}, ${reference ?? null}, ${fromCashVal})
    RETURNING id, amount, category, description, payment_method, reference, from_cash, created_at
  `);

  res.status(201).json({ success: true, data: rows.rows[0] });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!ALLOWED_ROLES.includes(user?.role)) throw new HttpError(403, 'No autorizado para eliminar gastos');

  const expenseId = parseInt(req.params.id);
  const [row] = await db.execute<{ id: number; branch_id: number }>(sql`
    SELECT id, branch_id FROM expenses WHERE id = ${expenseId}
  `).then(r => r.rows);

  if (!row) throw new HttpError(404, 'Gasto no encontrado');
  if (user.branchId && row.branch_id !== user.branchId && user.role !== 'admin_supremo') {
    throw new HttpError(403, 'Solo puedes eliminar gastos de tu sucursal');
  }

  await db.execute(sql`DELETE FROM expenses WHERE id = ${expenseId}`);
  res.json({ success: true, data: { id: expenseId } });
}));

export { router as expensesRoutes };
