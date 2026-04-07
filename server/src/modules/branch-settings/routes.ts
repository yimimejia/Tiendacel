import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { getBranchSettingsController, upsertBranchSettingsController } from './controller.js';
import { upsertBranchSettingsSchema } from './schema.js';

const router = Router();
router.use(authMiddleware, roleMiddleware(['administrador_general', 'encargado_sucursal']));

router.get('/', getBranchSettingsController);
router.put('/', validateRequest({ body: upsertBranchSettingsSchema }), upsertBranchSettingsController);

export { router as branchSettingsRoutes };
