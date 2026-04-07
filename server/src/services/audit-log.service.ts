import { db } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

interface AuditPayload {
  userId?: number | null;
  branchId?: number | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(payload: AuditPayload) {
  await db.insert(auditLogs).values({
    userId: payload.userId ?? null,
    branchId: payload.branchId ?? null,
    action: payload.action,
    entity: payload.entity,
    entityId: payload.entityId ?? null,
    description: payload.description,
    metadata: payload.metadata ?? null,
  });
}
