import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { HttpError } from '../../utils/http-error.js';

const router = Router();
router.use(authMiddleware);

const ALLOWED_ROLES = ['administrador_general', 'encargado_sucursal', 'admin_supremo', 'caja_ventas'];

router.get('/summary', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!ALLOWED_ROLES.includes(user?.role)) throw new HttpError(403, 'No autorizado');
  const branchId = user?.branchId;
  if (!branchId) throw new HttpError(400, 'Sin sucursal asignada');

  const since = req.query.since
    ? new Date(req.query.since as string).toISOString()
    : new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const salesResult = await db.execute<{ total_cash: string }>(sql`
    SELECT COALESCE(SUM(total), 0) AS total_cash
    FROM sales
    WHERE branch_id = ${branchId}
      AND payment_method = 'efectivo'
      AND created_at >= ${since}
  `);

  const expensesResult = await db.execute<{ total_cash_expenses: string }>(sql`
    SELECT COALESCE(SUM(amount), 0) AS total_cash_expenses
    FROM expenses
    WHERE branch_id = ${branchId}
      AND from_cash = true
      AND created_at >= ${since}
  `);

  const cashSales = parseFloat(salesResult.rows[0]?.total_cash ?? '0');
  const cashExpenses = parseFloat(expensesResult.rows[0]?.total_cash_expenses ?? '0');

  res.json({
    success: true,
    data: {
      cashSales,
      cashExpenses,
      since,
    },
  });
}));

router.post('/sessions', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!ALLOWED_ROLES.includes(user?.role)) throw new HttpError(403, 'No autorizado');
  const branchId = user?.branchId;
  if (!branchId) throw new HttpError(400, 'Sin sucursal asignada');

  const { opening_balance, actual_cash, notes, period_from, period_to } = req.body ?? {};
  if (actual_cash === undefined || actual_cash === null) {
    throw new HttpError(400, 'El efectivo contado es obligatorio');
  }

  const openingBal = parseFloat(opening_balance ?? '0');
  const actualCash = parseFloat(actual_cash);
  const periodFrom = period_from ?? new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const periodTo = period_to ?? new Date().toISOString();

  const salesResult = await db.execute<{ total_cash: string }>(sql`
    SELECT COALESCE(SUM(total), 0) AS total_cash
    FROM sales
    WHERE branch_id = ${branchId}
      AND payment_method = 'efectivo'
      AND created_at >= ${periodFrom}
      AND created_at <= ${periodTo}
  `);

  const expensesResult = await db.execute<{ total_cash_expenses: string }>(sql`
    SELECT COALESCE(SUM(amount), 0) AS total_cash_expenses
    FROM expenses
    WHERE branch_id = ${branchId}
      AND from_cash = true
      AND created_at >= ${periodFrom}
      AND created_at <= ${periodTo}
  `);

  const cashSales = parseFloat(salesResult.rows[0]?.total_cash ?? '0');
  const cashExpenses = parseFloat(expensesResult.rows[0]?.total_cash_expenses ?? '0');
  const expectedCash = openingBal + cashSales - cashExpenses;
  const difference = actualCash - expectedCash;

  let status = 'exact';
  if (difference > 0.01) status = 'surplus';
  else if (difference < -0.01) status = 'shortage';

  const rows = await db.execute<{ id: number }>(sql`
    INSERT INTO cash_register_sessions
      (branch_id, created_by_user_id, opening_balance, expected_cash, actual_cash, difference, status, notes, period_from, period_to)
    VALUES
      (${branchId}, ${user.id}, ${openingBal}, ${expectedCash}, ${actualCash}, ${difference}, ${status}, ${notes ?? null}, ${periodFrom}, ${periodTo})
    RETURNING *
  `);

  res.status(201).json({ success: true, data: rows.rows[0] });
}));

router.get('/sessions', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!ALLOWED_ROLES.includes(user?.role)) throw new HttpError(403, 'No autorizado');
  const branchId = user?.branchId;
  if (!branchId) throw new HttpError(400, 'Sin sucursal asignada');

  const rows = await db.execute<{
    id: number; opening_balance: string; expected_cash: string; actual_cash: string;
    difference: string; status: string; notes: string | null; period_from: string;
    period_to: string; created_at: string; creator_name: string;
  }>(sql`
    SELECT s.*,
           COALESCE(u.full_name, 'Sistema') AS creator_name
    FROM cash_register_sessions s
    LEFT JOIN users u ON u.id = s.created_by_user_id
    WHERE s.branch_id = ${branchId}
    ORDER BY s.created_at DESC
    LIMIT 200
  `);

  res.json({ success: true, data: rows.rows });
}));

export { router as cajaRoutes };
