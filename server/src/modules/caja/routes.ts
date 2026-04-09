import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { HttpError } from '../../utils/http-error.js';

const router = Router();
router.use(authMiddleware);

const ALLOWED_ROLES = ['administrador_general', 'encargado_sucursal', 'admin_supremo', 'caja_ventas'];

router.get('/my-session', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!ALLOWED_ROLES.includes(user?.role)) throw new HttpError(403, 'No autorizado');

  const rows = await db.execute<{
    id: number; branch_id: number; opened_by_user_id: number; opening_balance: string;
    status: string; opened_at: string; opener_name: string;
  }>(sql`
    SELECT cs.*, COALESCE(u.full_name, 'Usuario') AS opener_name
    FROM cash_sessions cs
    LEFT JOIN users u ON u.id = cs.opened_by_user_id
    WHERE cs.opened_by_user_id = ${user.id}
      AND cs.status = 'open'
    ORDER BY cs.opened_at DESC
    LIMIT 1
  `);

  res.json({ success: true, data: rows.rows[0] ?? null });
}));

router.post('/open-session', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!ALLOWED_ROLES.includes(user?.role)) throw new HttpError(403, 'No autorizado');
  const branchId = user?.branchId;
  if (!branchId) throw new HttpError(400, 'Sin sucursal asignada');

  const existing = await db.execute<{ id: number }>(sql`
    SELECT id FROM cash_sessions
    WHERE opened_by_user_id = ${user.id} AND status = 'open'
    LIMIT 1
  `);
  if (existing.rows.length > 0) {
    throw new HttpError(400, 'Ya tienes una caja abierta. Realiza un cuadre antes de abrir una nueva.');
  }

  const { opening_balance } = req.body ?? {};
  const openingBal = parseFloat(opening_balance ?? '0');
  if (isNaN(openingBal) || openingBal < 0) throw new HttpError(400, 'El fondo inicial debe ser un número válido');

  const rows = await db.execute<{ id: number; opened_at: string }>(sql`
    INSERT INTO cash_sessions (branch_id, opened_by_user_id, opening_balance, status)
    VALUES (${branchId}, ${user.id}, ${openingBal}, 'open')
    RETURNING *
  `);

  res.status(201).json({ success: true, data: rows.rows[0] });
}));

router.get('/summary', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!ALLOWED_ROLES.includes(user?.role)) throw new HttpError(403, 'No autorizado');
  const branchId = user?.branchId;
  if (!branchId) throw new HttpError(400, 'Sin sucursal asignada');

  const sessionRows = await db.execute<{ id: number; opening_balance: string; opened_at: string }>(sql`
    SELECT id, opening_balance, opened_at FROM cash_sessions
    WHERE opened_by_user_id = ${user.id} AND status = 'open'
    ORDER BY opened_at DESC LIMIT 1
  `);

  const session = sessionRows.rows[0] ?? null;
  const since = session
    ? session.opened_at
    : req.query.since
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
      openingBalance: session ? parseFloat(session.opening_balance) : 0,
      sessionOpenedAt: session?.opened_at ?? null,
      sessionId: session?.id ?? null,
    },
  });
}));

router.post('/sessions', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!ALLOWED_ROLES.includes(user?.role)) throw new HttpError(403, 'No autorizado');
  const branchId = user?.branchId;
  if (!branchId) throw new HttpError(400, 'Sin sucursal asignada');

  const { opening_balance, actual_cash, notes, period_from, period_to, denomination_breakdown } = req.body ?? {};
  if (actual_cash === undefined || actual_cash === null) {
    throw new HttpError(400, 'El efectivo contado es obligatorio');
  }

  const sessionRows = await db.execute<{ id: number; opening_balance: string; opened_at: string }>(sql`
    SELECT id, opening_balance, opened_at FROM cash_sessions
    WHERE opened_by_user_id = ${user.id} AND status = 'open'
    ORDER BY opened_at DESC LIMIT 1
  `);
  const openSession = sessionRows.rows[0] ?? null;

  const openingBal = openSession
    ? parseFloat(openSession.opening_balance)
    : parseFloat(opening_balance ?? '0');
  const actualCash = parseFloat(actual_cash);
  const periodFrom = openSession?.opened_at ?? period_from ?? new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
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

  const denomJson = denomination_breakdown ? JSON.stringify(denomination_breakdown) : null;

  const rows = await db.execute<{ id: number }>(sql`
    INSERT INTO cash_register_sessions
      (branch_id, created_by_user_id, opening_balance, expected_cash, actual_cash, difference, status, notes, period_from, period_to, denomination_breakdown)
    VALUES
      (${branchId}, ${user.id}, ${openingBal}, ${expectedCash}, ${actualCash}, ${difference}, ${status},
       ${notes ?? null}, ${periodFrom}, ${periodTo}, ${denomJson}::jsonb)
    RETURNING *
  `);

  const cuadreId = (rows.rows[0] as any).id;

  if (openSession) {
    await db.execute(sql`
      UPDATE cash_sessions
      SET status = 'closed', closed_at = NOW(), cuadre_id = ${cuadreId}
      WHERE id = ${openSession.id}
    `);
  }

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
    period_to: string; created_at: string; creator_name: string; denomination_breakdown: any;
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
