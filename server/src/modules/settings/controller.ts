import type { Request, Response } from 'express';
import { createAuditLog } from '../../services/audit-log.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { listSettings, upsertSetting } from './service.js';

export async function listSettingsController(_req: Request, res: Response) {
  return sendSuccess(res, 'Configuraciones obtenidas correctamente', await listSettings());
}

export async function upsertSettingController(req: Request, res: Response) {
  const setting = await upsertSetting(req.body);

  await createAuditLog({
    userId: Number(req.user?.id),
    branchId: null,
    action: 'settings_upsert',
    entity: 'settings',
    entityId: setting.key,
    description: `Configuración actualizada: ${setting.key}`,
  });

  return sendSuccess(res, 'Configuración guardada correctamente', setting);
}
