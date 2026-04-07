import { and, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { customers, devices, products, sales } from '../../db/schema.js';

interface SearchContext {
  role: string;
  branchId: number | null;
}

export async function globalSearch(term: string, context: SearchContext) {
  const likeTerm = `%${term}%`;
  const isGlobal = context.role === 'administrador_general';

  const customerWhere = isGlobal
    ? or(ilike(customers.fullName, likeTerm), ilike(customers.phone, likeTerm))
    : and(eq(customers.branchId, context.branchId ?? -1), or(ilike(customers.fullName, likeTerm), ilike(customers.phone, likeTerm)));

  const deviceWhere = isGlobal
    ? or(ilike(devices.deviceNumber, likeTerm), ilike(devices.imeiOrSerial, likeTerm), ilike(devices.model, likeTerm))
    : and(
        eq(devices.branchId, context.branchId ?? -1),
        or(ilike(devices.deviceNumber, likeTerm), ilike(devices.imeiOrSerial, likeTerm), ilike(devices.model, likeTerm)),
      );

  const saleWhere = isGlobal
    ? ilike(sales.saleNumber, likeTerm)
    : and(eq(sales.branchId, context.branchId ?? -1), ilike(sales.saleNumber, likeTerm));

  const [customerResults, deviceResults, productResults, saleResults] = await Promise.all([
    db.select({ id: customers.id, label: customers.fullName, subtitle: customers.phone }).from(customers).where(customerWhere).limit(6),
    db.select({ id: devices.id, label: devices.deviceNumber, subtitle: devices.model }).from(devices).where(deviceWhere).limit(6),
    db.select({ id: products.id, label: products.name, subtitle: products.sku }).from(products).where(or(ilike(products.name, likeTerm), ilike(products.sku, likeTerm))).limit(6),
    db.select({ id: sales.id, label: sales.saleNumber, subtitle: sales.reference }).from(sales).where(saleWhere).limit(6),
  ]);

  return { customers: customerResults, devices: deviceResults, products: productResults, sales: saleResults };
}
