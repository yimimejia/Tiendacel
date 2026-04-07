import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

const router = Router();

router.get('/health', async (_req, res, next) => {
  try {
    const result = await db.execute<{ now: string }>(sql`select now()::text as now`);
    res.json({
      ok: true,
      mensaje: 'Servidor operativo',
      fechaServidor: result.rows[0]?.now ?? null,
    });
  } catch (error) {
    next(error);
  }
});

export { router as apiRouter };
