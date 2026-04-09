import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { HttpError } from '../../utils/http-error.js';

export const NCF_TYPES = [
  { code: 'B01', label: 'Crédito Fiscal' },
  { code: 'B02', label: 'Consumidor Final' },
  { code: 'B03', label: 'Nota de Débito' },
  { code: 'B04', label: 'Nota de Crédito' },
  { code: 'B11', label: 'Comprobante de Compras' },
  { code: 'B12', label: 'Registro Único de Ingresos' },
  { code: 'B13', label: 'Gastos Menores' },
  { code: 'B14', label: 'Régimen Especial' },
  { code: 'B15', label: 'Gubernamental' },
  { code: 'B16', label: 'Comprobante para Exportaciones' },
] as const;

export type NcfCode = (typeof NCF_TYPES)[number]['code'];

export interface NcfSequence {
  id: number;
  branch_id: number;
  type: string;
  label: string;
  sequence_from: number;
  sequence_to: number;
  current_sequence: number;
  is_active: boolean;
  alert_threshold: number;
  remaining: number;
  next_ncf: string;
  is_exhausted: boolean;
  is_low: boolean;
}

function formatNcf(type: string, sequence: number): string {
  return `${type}${String(sequence).padStart(8, '0')}`;
}

export async function listNcfSequences(branchId: number): Promise<NcfSequence[]> {
  const rows = await db.execute<{
    id: number; branch_id: number; type: string; label: string;
    sequence_from: number; sequence_to: number; current_sequence: number;
    is_active: boolean; alert_threshold: number;
  }>(sql`
    SELECT id, branch_id, type, label,
      sequence_from::int, sequence_to::int, current_sequence::int,
      is_active, alert_threshold::int
    FROM ncf_sequences
    WHERE branch_id = ${branchId}
    ORDER BY type ASC
  `);

  return rows.rows.map((r) => {
    const remaining = r.sequence_to - r.current_sequence + 1;
    return {
      id: r.id,
      branch_id: r.branch_id,
      type: r.type,
      label: r.label,
      sequence_from: r.sequence_from,
      sequence_to: r.sequence_to,
      current_sequence: r.current_sequence,
      is_active: r.is_active,
      alert_threshold: r.alert_threshold,
      remaining: Math.max(0, remaining),
      next_ncf: r.current_sequence <= r.sequence_to ? formatNcf(r.type, r.current_sequence) : 'AGOTADO',
      is_exhausted: r.current_sequence > r.sequence_to,
      is_low: remaining <= r.alert_threshold && remaining > 0,
    };
  });
}

export async function upsertNcfSequence(branchId: number, input: {
  type: string;
  sequence_from: number;
  sequence_to: number;
  alert_threshold?: number;
  is_active?: boolean;
}): Promise<NcfSequence> {
  const ncfType = NCF_TYPES.find((t) => t.code === input.type);
  if (!ncfType) throw new HttpError(400, `Tipo de NCF inválido: ${input.type}`);
  if (input.sequence_from < 1) throw new HttpError(400, 'La secuencia inicial debe ser mayor a 0');
  if (input.sequence_to < input.sequence_from) throw new HttpError(400, 'La secuencia final debe ser mayor o igual a la inicial');

  await db.execute(sql`
    INSERT INTO ncf_sequences (branch_id, type, label, sequence_from, sequence_to, current_sequence, is_active, alert_threshold)
    VALUES (
      ${branchId}, ${input.type}, ${ncfType.label},
      ${input.sequence_from}, ${input.sequence_to}, ${input.sequence_from},
      ${input.is_active ?? true}, ${input.alert_threshold ?? 10}
    )
    ON CONFLICT (branch_id, type) DO UPDATE SET
      label = EXCLUDED.label,
      sequence_from = EXCLUDED.sequence_from,
      sequence_to = EXCLUDED.sequence_to,
      current_sequence = EXCLUDED.sequence_from,
      is_active = COALESCE(${input.is_active ?? null}::boolean, ncf_sequences.is_active),
      alert_threshold = EXCLUDED.alert_threshold,
      updated_at = now()
  `);

  const list = await listNcfSequences(branchId);
  const updated = list.find((s) => s.type === input.type);
  if (!updated) throw new HttpError(500, 'Error al recuperar la secuencia NCF');
  return updated;
}

export async function patchNcfSequence(id: number, branchId: number, input: {
  is_active?: boolean;
  alert_threshold?: number;
  sequence_to?: number;
}): Promise<NcfSequence> {
  await db.execute(sql`
    UPDATE ncf_sequences SET
      is_active = COALESCE(${input.is_active ?? null}::boolean, is_active),
      alert_threshold = COALESCE(${input.alert_threshold ?? null}::int, alert_threshold),
      sequence_to = COALESCE(${input.sequence_to ?? null}::int, sequence_to),
      updated_at = now()
    WHERE id = ${id} AND branch_id = ${branchId}
  `);

  const list = await listNcfSequences(branchId);
  const updated = list.find((s) => s.id === id);
  if (!updated) throw new HttpError(404, 'Secuencia NCF no encontrada');
  return updated;
}

export async function deleteNcfSequence(id: number, branchId: number): Promise<void> {
  await db.execute(sql`
    DELETE FROM ncf_sequences WHERE id = ${id} AND branch_id = ${branchId}
  `);
}

export async function getNextNcf(branchId: number, type: string): Promise<{ ncf: string; sequence: number }> {
  const result = await db.execute<{ issued_sequence: number }>(sql`
    UPDATE ncf_sequences
    SET current_sequence = current_sequence + 1, updated_at = now()
    WHERE branch_id = ${branchId}
      AND type = ${type}
      AND is_active = true
      AND current_sequence <= sequence_to
    RETURNING current_sequence - 1 AS issued_sequence
  `);

  if (result.rows.length === 0) {
    throw new HttpError(422, `No hay secuencia NCF activa disponible para el tipo ${type}. Verifique la configuración de comprobantes.`);
  }

  const seq = result.rows[0].issued_sequence;
  return { ncf: formatNcf(type, seq), sequence: seq };
}
