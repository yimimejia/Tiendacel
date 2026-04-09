import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { HttpError } from '../../utils/http-error.js';
import { createProduct, deleteProduct, listProductsForBranch, updateProduct } from './service.js';

function resolveBranchId(req: Request): number {
  const role = String(req.user?.role ?? '');
  if (role === 'admin_supremo') {
    const candidate = Number(req.query.branch_id ?? req.body.branch_id ?? 0);
    if (!candidate) throw new HttpError(400, 'branch_id es requerido para admin_supremo en productos');
    return candidate;
  }
  if (!req.user?.branchId) throw new HttpError(403, 'Usuario sin sucursal asignada');
  return Number(req.user.branchId);
}

export async function listProductsController(req: Request, res: Response) {
  const branchId = resolveBranchId(req);
  const search = req.query.search ? String(req.query.search) : undefined;
  const data = await listProductsForBranch(branchId, search);
  return sendSuccess(res, 'Productos obtenidos correctamente', data);
}

export async function createProductController(req: Request, res: Response) {
  const branchId = resolveBranchId(req);
  const { name, sku, category_id, cost, sale_price, stock, photos, itbis_aplica, itbis_tasa, precio_incluye_itbis } = req.body;
  if (!name?.trim()) throw new HttpError(400, 'El nombre del producto es obligatorio');
  if (cost === undefined || sale_price === undefined) throw new HttpError(400, 'Costo y precio son obligatorios');
  const data = await createProduct(branchId, {
    name: String(name).trim(),
    sku: sku ? String(sku) : null,
    category_id: category_id ? Number(category_id) : undefined,
    cost: Number(cost),
    sale_price: Number(sale_price),
    stock: Number(stock ?? 0),
    photos: Array.isArray(photos) ? photos : [],
    itbis_aplica: itbis_aplica !== undefined ? Boolean(itbis_aplica) : undefined,
    itbis_tasa: itbis_tasa !== undefined ? Number(itbis_tasa) : undefined,
    precio_incluye_itbis: precio_incluye_itbis !== undefined ? Boolean(precio_incluye_itbis) : undefined,
  });
  return sendSuccess(res, 'Producto creado correctamente', data, 201);
}

export async function updateProductController(req: Request, res: Response) {
  const branchId = resolveBranchId(req);
  const productId = Number(req.params.id);
  if (!productId) throw new HttpError(400, 'ID de producto inválido');
  const { name, sku, category_id, cost, sale_price, stock, photos, itbis_aplica, itbis_tasa, precio_incluye_itbis } = req.body;
  const data = await updateProduct(productId, branchId, {
    name: name ? String(name).trim() : undefined,
    sku: sku !== undefined ? (sku ? String(sku) : null) : undefined,
    category_id: category_id !== undefined ? Number(category_id) : undefined,
    cost: cost !== undefined ? Number(cost) : undefined,
    sale_price: sale_price !== undefined ? Number(sale_price) : undefined,
    stock: stock !== undefined ? Number(stock) : undefined,
    photos: Array.isArray(photos) ? photos : undefined,
    itbis_aplica: itbis_aplica !== undefined ? Boolean(itbis_aplica) : undefined,
    itbis_tasa: itbis_tasa !== undefined ? Number(itbis_tasa) : undefined,
    precio_incluye_itbis: precio_incluye_itbis !== undefined ? Boolean(precio_incluye_itbis) : undefined,
  });
  return sendSuccess(res, 'Producto actualizado correctamente', data);
}

export async function deleteProductController(req: Request, res: Response) {
  const productId = Number(req.params.id);
  if (!productId) throw new HttpError(400, 'ID de producto inválido');
  await deleteProduct(productId);
  return sendSuccess(res, 'Producto eliminado correctamente', null);
}
