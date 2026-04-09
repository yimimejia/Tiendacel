import { Router } from 'express';
import { sql, eq, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { inventoryTransfers } from '../../db/schema.js';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { HttpError } from '../../utils/http-error.js';

const router = Router();
router.use(authMiddleware);

router.get('/stats', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const branchId: number | null = user?.branchId ?? null;

  if (!branchId) {
    res.json({ success: true, data: null });
    return;
  }

  const [[customersRow], [repairsRow], [salesRow]] = await Promise.all([
    db.execute<{ total: string }>(sql`
      SELECT COUNT(*) AS total FROM customers
      WHERE branch_id = ${branchId}
    `).then(r => r.rows),
    db.execute<{ active: string; delivered: string; total: string }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE internal_status NOT IN ('Entregado', 'Cancelado', 'No reparable')) AS active,
        COUNT(*) FILTER (WHERE internal_status = 'Entregado') AS delivered,
        COUNT(*) AS total
      FROM devices WHERE branch_id = ${branchId}
    `).then(r => r.rows),
    db.execute<{ count: string; revenue: string }>(sql`
      SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue
      FROM sales
      WHERE branch_id = ${branchId}
        AND created_at >= CURRENT_DATE
    `).then(r => r.rows),
  ]);

  res.json({
    success: true,
    data: {
      customers: parseInt(customersRow?.total ?? '0'),
      activeRepairs: parseInt(repairsRow?.active ?? '0'),
      deliveredRepairs: parseInt(repairsRow?.delivered ?? '0'),
      totalRepairs: parseInt(repairsRow?.total ?? '0'),
      salesToday: parseInt(salesRow?.count ?? '0'),
      revenueToday: parseFloat(salesRow?.revenue ?? '0'),
    },
  });
}));

router.get('/audit-logs', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const branchId: number | null = user?.branchId ?? null;
  const limit = Math.min(parseInt((req.query.limit as string) ?? '50'), 200);

  const condition = branchId
    ? sql`WHERE a.branch_id = ${branchId}`
    : sql`WHERE 1=1`;

  const rows = await db.execute<{
    id: number; action: string; entity: string; entity_id: string;
    description: string; created_at: string; user_name: string;
  }>(sql`
    SELECT a.id, a.action, a.entity, a.entity_id, a.description, a.created_at,
           COALESCE(u.full_name, 'Sistema') AS user_name
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ${condition}
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `);

  res.json({ success: true, data: rows.rows });
}));

router.get('/reports/sales', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const branchId: number | null = user?.branchId ?? null;
  const days = Math.min(parseInt((req.query.days as string) ?? '30'), 365);

  const condition = branchId
    ? sql`AND s.branch_id = ${branchId}`
    : sql``;

  const rows = await db.execute<{
    date: string; sales_count: string; revenue: string; items_sold: string;
  }>(sql`
    SELECT
      DATE(s.created_at AT TIME ZONE 'America/Santo_Domingo') AS date,
      COUNT(DISTINCT s.id) AS sales_count,
      SUM(s.total) AS revenue,
      COALESCE(SUM(si.quantity), 0) AS items_sold
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.created_at >= NOW() - (${days} || ' days')::INTERVAL
    ${condition}
    GROUP BY DATE(s.created_at AT TIME ZONE 'America/Santo_Domingo')
    ORDER BY date DESC
  `);

  const conditionNoAlias = branchId
    ? sql`AND branch_id = ${branchId}`
    : sql``;

  const totals = await db.execute<{ total_sales: string; total_revenue: string }>(sql`
    SELECT COUNT(*) AS total_sales, COALESCE(SUM(total), 0) AS total_revenue
    FROM sales
    WHERE created_at >= NOW() - (${days} || ' days')::INTERVAL
    ${conditionNoAlias}
  `);

  res.json({
    success: true,
    data: {
      days,
      totals: {
        sales: parseInt(totals.rows[0]?.total_sales ?? '0'),
        revenue: parseFloat(totals.rows[0]?.total_revenue ?? '0'),
      },
      byDay: rows.rows.map(r => ({
        date: r.date,
        salesCount: parseInt(r.sales_count),
        revenue: parseFloat(r.revenue ?? '0'),
        itemsSold: parseInt(r.items_sold ?? '0'),
      })),
    },
  });
}));

router.get('/my-stats', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const userId: number = user?.id;
  const branchId: number | null = user?.branchId ?? null;

  if (!branchId) {
    res.json({ success: true, data: { myPending: 0, myCompleted: 0, myTotal: 0 } });
    return;
  }

  const rows = await db.execute<{ pending: string; completed: string }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE internal_status NOT IN ('Entregado', 'Cancelado', 'No reparable')) AS pending,
      COUNT(*) FILTER (WHERE internal_status IN ('Entregado', 'Cancelado', 'No reparable')) AS completed
    FROM devices
    WHERE branch_id = ${branchId} AND technician_id = ${userId}
  `);

  const row = rows.rows[0];
  const pending = parseInt(row?.pending ?? '0');
  const completed = parseInt(row?.completed ?? '0');
  res.json({ success: true, data: { myPending: pending, myCompleted: completed, myTotal: pending + completed } });
}));

const inventoryRouter = Router();
inventoryRouter.use(authMiddleware);

inventoryRouter.get('/transfers', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const branchId: number | null = user?.branchId ?? null;

  const condition = branchId
    ? sql`WHERE (t.origin_branch_id = ${branchId} OR t.destination_branch_id = ${branchId})`
    : sql`WHERE 1=1`;

  const rows = await db.execute<{
    id: number; origin_branch_id: number; destination_branch_id: number;
    status: string; note: string | null; created_at: string;
    origin_name: string; destination_name: string; creator_name: string;
  }>(sql`
    SELECT t.id, t.origin_branch_id, t.destination_branch_id, t.status, t.note, t.created_at,
           ob.name AS origin_name, db.name AS destination_name,
           COALESCE(u.full_name, 'Sistema') AS creator_name
    FROM inventory_transfers t
    LEFT JOIN branches ob ON ob.id = t.origin_branch_id
    LEFT JOIN branches db ON db.id = t.destination_branch_id
    LEFT JOIN users u ON u.id = t.created_by_user_id
    ${condition}
    ORDER BY t.created_at DESC
    LIMIT 100
  `);

  const transferIds = rows.rows.map(r => r.id);
  let itemsMap: Record<number, any[]> = {};
  if (transferIds.length > 0) {
    const items = await db.execute<{
      transfer_id: number; product_id: number; quantity: string; product_name: string; product_code: string;
    }>(sql`
      SELECT ti.transfer_id, ti.product_id, ti.quantity,
             p.name AS product_name, COALESCE(p.barcode, p.code, '') AS product_code
      FROM inventory_transfer_items ti
      JOIN products p ON p.id = ti.product_id
      WHERE ti.transfer_id = ANY(ARRAY[${sql.join(transferIds.map(id => sql`${id}`), sql`, `)}])
    `);
    for (const item of items.rows) {
      if (!itemsMap[item.transfer_id]) itemsMap[item.transfer_id] = [];
      itemsMap[item.transfer_id].push({ product_id: item.product_id, product_name: item.product_name, product_code: item.product_code, quantity: parseFloat(item.quantity) });
    }
  }

  res.json({ success: true, data: rows.rows.map(r => ({ ...r, items: itemsMap[r.id] ?? [] })) });
}));

inventoryRouter.post('/transfers', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!user?.branchId) throw new HttpError(400, 'No tienes sucursal asignada');
  if (!['administrador_general', 'encargado_sucursal'].includes(user.role)) {
    throw new HttpError(403, 'No autorizado para crear transferencias');
  }

  const { destination_branch_id, note, items } = req.body ?? {};
  if (!destination_branch_id) throw new HttpError(400, 'Sucursal destino requerida');
  if (parseInt(destination_branch_id) === user.branchId) throw new HttpError(400, 'La sucursal destino debe ser diferente a la de origen');

  const [created] = await db.insert(inventoryTransfers).values({
    originBranchId: user.branchId,
    destinationBranchId: parseInt(destination_branch_id),
    createdByUserId: user.id,
    note: note ?? null,
  }).returning();

  if (Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      if (item.product_id && item.quantity > 0) {
        await db.execute(sql`
          INSERT INTO inventory_transfer_items (transfer_id, product_id, quantity)
          VALUES (${created.id}, ${parseInt(item.product_id)}, ${parseFloat(item.quantity)})
        `);
      }
    }
  }

  res.status(201).json({ success: true, data: created });
}));

export { router as dashboardRoutes, inventoryRouter };
