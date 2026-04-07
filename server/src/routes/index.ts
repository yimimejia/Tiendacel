import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { authRoutes } from '../modules/auth/routes.js';
import { branchesRoutes } from '../modules/branches/routes.js';
import { customersRoutes } from '../modules/customers/routes.js';
import { rolesRoutes } from '../modules/roles/routes.js';
import { usersRoutes } from '../modules/users/routes.js';
import { settingsRoutes } from '../modules/settings/routes.js';
import { searchRoutes } from '../modules/search/routes.js';
import { uploadsRoutes } from '../modules/uploads/routes.js';
import { repairsRoutes } from '../modules/repairs/routes.js';

const router = Router();

router.get('/health', async (_req, res, next) => {
  try {
    const result = await db.execute<{ now: string }>(sql`select now()::text as now`);
    res.json({ success: true, message: 'Servidor operativo', data: { fechaServidor: result.rows[0]?.now ?? null } });
  } catch (error) {
    next(error);
  }
});

router.use('/auth', authRoutes);
router.use('/roles', rolesRoutes);
router.use('/branches', branchesRoutes);
router.use('/users', usersRoutes);
router.use('/customers', customersRoutes);
router.use('/settings', settingsRoutes);
router.use('/search', searchRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/repairs', repairsRoutes);

export { router as apiRouter };
