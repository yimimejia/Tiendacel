import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { listSettingsController, upsertSettingController } from './controller.js';
import { upsertSettingSchema } from './schema.js';

const router = Router();
router.use(authMiddleware, roleMiddleware(['administrador_general']));
router.get('/', asyncHandler(listSettingsController));
router.put('/', validateRequest({ body: upsertSettingSchema }), asyncHandler(upsertSettingController));

export { router as settingsRoutes };
