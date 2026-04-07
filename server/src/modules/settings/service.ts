import { asc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { settings } from '../../db/schema.js';

export async function listSettings() {
  return db.select().from(settings).orderBy(asc(settings.key));
}

export async function upsertSetting(input: { key: string; value: string; description?: string }) {
  const [existing] = await db.select().from(settings).where(eq(settings.key, input.key)).limit(1);

  if (existing) {
    const [updated] = await db
      .update(settings)
      .set({ value: input.value, description: input.description ?? null, updatedAt: new Date() })
      .where(eq(settings.key, input.key))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(settings)
    .values({ key: input.key, value: input.value, description: input.description ?? null })
    .returning();
  return created;
}
