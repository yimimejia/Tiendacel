import { asc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { roles } from '../../db/schema.js';

export async function listRoles() {
  return db.select().from(roles).orderBy(asc(roles.name));
}
