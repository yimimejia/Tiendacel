import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { globalSearch } from './service.js';

export async function globalSearchController(req: Request, res: Response) {
  const q = String(req.query.q ?? '').trim();
  if (!q) return sendSuccess(res, 'Búsqueda vacía', { customers: [], devices: [], products: [], sales: [] });
  return sendSuccess(res, 'Búsqueda global completada', await globalSearch(q));
}
