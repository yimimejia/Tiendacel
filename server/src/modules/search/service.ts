import { ilike, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { customers, devices, products, sales } from '../../db/schema.js';

export async function globalSearch(term: string) {
  const likeTerm = `%${term}%`;

  const [customerResults, deviceResults, productResults, saleResults] = await Promise.all([
    db.select({ id: customers.id, label: customers.fullName, subtitle: customers.phone }).from(customers).where(or(ilike(customers.fullName, likeTerm), ilike(customers.phone, likeTerm))).limit(6),
    db.select({ id: devices.id, label: devices.deviceNumber, subtitle: devices.model }).from(devices).where(or(ilike(devices.deviceNumber, likeTerm), ilike(devices.imeiOrSerial, likeTerm), ilike(devices.model, likeTerm))).limit(6),
    db.select({ id: products.id, label: products.name, subtitle: products.sku }).from(products).where(or(ilike(products.name, likeTerm), ilike(products.sku, likeTerm))).limit(6),
    db.select({ id: sales.id, label: sales.saleNumber, subtitle: sales.reference }).from(sales).where(ilike(sales.saleNumber, likeTerm)).limit(6),
  ]);

  return { customers: customerResults, devices: deviceResults, products: productResults, sales: saleResults };
}
