import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';

export interface ProductWithStock {
  id: number;
  name: string;
  sku: string | null;
  category_id: number;
  cost: string;
  sale_price: string;
  photos: string[];
  itbis_aplica: boolean;
  itbis_tasa: string;
  precio_incluye_itbis: boolean;
  stock: number;
}

export async function listProductsForBranch(branchId: number, search?: string): Promise<ProductWithStock[]> {
  const rows = await db.execute<{
    id: number; name: string; sku: string | null; category_id: number;
    cost: string; sale_price: string; photos: unknown;
    itbis_aplica: boolean; itbis_tasa: string; precio_incluye_itbis: boolean;
    current_stock: number;
  }>(sql`
    SELECT
      p.id, p.name, p.sku, p.category_id,
      p.cost::text, p.sale_price::text,
      COALESCE(p.photos, '[]'::jsonb) AS photos,
      COALESCE(p.itbis_aplica, true) AS itbis_aplica,
      COALESCE(p.itbis_tasa, 0.18)::text AS itbis_tasa,
      COALESCE(p.precio_incluye_itbis, true) AS precio_incluye_itbis,
      COALESCE(i.current_stock, 0)::int AS current_stock
    FROM products p
    LEFT JOIN inventories i ON i.product_id = p.id AND i.branch_id = ${branchId}
    WHERE p.is_active = true AND p.deleted_at IS NULL
      ${search ? sql`AND p.name ILIKE ${'%' + search + '%'}` : sql``}
    ORDER BY p.name ASC
  `);

  return rows.rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    category_id: r.category_id,
    cost: r.cost,
    sale_price: r.sale_price,
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
    itbis_aplica: Boolean(r.itbis_aplica ?? true),
    itbis_tasa: r.itbis_tasa ?? '0.18',
    precio_incluye_itbis: Boolean(r.precio_incluye_itbis ?? true),
    stock: Number(r.current_stock ?? 0),
  }));
}

export async function createProduct(branchId: number, input: {
  name: string;
  sku?: string | null;
  category_id?: number;
  cost: number;
  sale_price: number;
  stock: number;
  photos?: string[];
  itbis_aplica?: boolean;
  itbis_tasa?: number;
  precio_incluye_itbis?: boolean;
}): Promise<ProductWithStock> {
  const photosJson = JSON.stringify(input.photos ?? []);
  const itbisAplica = input.itbis_aplica ?? true;
  const itbisTasa = input.itbis_tasa ?? 0.18;
  const precioIncluyeItbis = input.precio_incluye_itbis ?? true;
  const categoryId = input.category_id ?? 1;

  const result = await db.execute<{ id: number }>(sql`
    INSERT INTO products (name, sku, category_id, cost, sale_price, photos, itbis_aplica, itbis_tasa, precio_incluye_itbis)
    VALUES (
      ${input.name},
      ${input.sku ?? null},
      ${categoryId},
      ${input.cost},
      ${input.sale_price},
      ${photosJson}::jsonb,
      ${itbisAplica},
      ${itbisTasa},
      ${precioIncluyeItbis}
    )
    RETURNING id
  `);

  const productId = result.rows[0].id;

  await db.execute(sql`
    INSERT INTO inventories (product_id, branch_id, current_stock, minimum_stock)
    VALUES (${productId}, ${branchId}, ${input.stock}, 0)
    ON CONFLICT (product_id, branch_id) DO UPDATE SET current_stock = EXCLUDED.current_stock
  `);

  return {
    id: productId,
    name: input.name,
    sku: input.sku ?? null,
    category_id: categoryId,
    cost: String(input.cost),
    sale_price: String(input.sale_price),
    photos: input.photos ?? [],
    itbis_aplica: itbisAplica,
    itbis_tasa: String(itbisTasa),
    precio_incluye_itbis: precioIncluyeItbis,
    stock: input.stock,
  };
}

export async function updateProduct(productId: number, branchId: number, input: {
  name?: string;
  sku?: string | null;
  category_id?: number;
  cost?: number;
  sale_price?: number;
  stock?: number;
  photos?: string[];
  itbis_aplica?: boolean;
  itbis_tasa?: number;
  precio_incluye_itbis?: boolean;
}): Promise<ProductWithStock> {
  if (input.photos !== undefined) {
    await db.execute(sql`
      UPDATE products SET photos = ${JSON.stringify(input.photos)}::jsonb, updated_at = now()
      WHERE id = ${productId}
    `);
  }

  await db.execute(sql`
    UPDATE products SET
      name = COALESCE(${input.name ?? null}::varchar, name),
      sku = COALESCE(${input.sku ?? null}::varchar, sku),
      category_id = COALESCE(${input.category_id ?? null}::int, category_id),
      cost = COALESCE(${input.cost ?? null}::numeric, cost),
      sale_price = COALESCE(${input.sale_price ?? null}::numeric, sale_price),
      itbis_aplica = COALESCE(${input.itbis_aplica ?? null}::boolean, itbis_aplica),
      itbis_tasa = COALESCE(${input.itbis_tasa ?? null}::numeric, itbis_tasa),
      precio_incluye_itbis = COALESCE(${input.precio_incluye_itbis ?? null}::boolean, precio_incluye_itbis),
      updated_at = now()
    WHERE id = ${productId}
  `);

  if (input.stock !== undefined) {
    await db.execute(sql`
      INSERT INTO inventories (product_id, branch_id, current_stock, minimum_stock)
      VALUES (${productId}, ${branchId}, ${input.stock}, 0)
      ON CONFLICT (product_id, branch_id) DO UPDATE SET current_stock = EXCLUDED.current_stock, updated_at = now()
    `);
  }

  const list = await listProductsForBranch(branchId);
  const updated = list.find((p) => p.id === productId);
  if (!updated) throw new Error('Producto no encontrado después de actualizar');
  return updated;
}

export async function deleteProduct(productId: number): Promise<void> {
  await db.execute(sql`
    UPDATE products SET is_active = false, deleted_at = now() WHERE id = ${productId}
  `);
}
