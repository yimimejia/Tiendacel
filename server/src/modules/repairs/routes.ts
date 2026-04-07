import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import {
  assignRepairController,
  listAssignableTechniciansController,
  listRepairsController,
  takeRepairWorkController,
} from './controller.js';
import { assignRepairSchema, repairIdParamSchema } from './schema.js';

const router = Router();
router.use(authMiddleware);

router.get('/', listRepairsController);
router.get('/assignable-technicians', listAssignableTechniciansController);
router.post('/:id/take-work', roleMiddleware(['tecnico']), validateRequest({ params: repairIdParamSchema }), takeRepairWorkController);
router.patch(
  '/:id/assignment',
  roleMiddleware(['administrador_general', 'encargado_sucursal']),
  validateRequest({ params: repairIdParamSchema, body: assignRepairSchema }),
  assignRepairController,
);

export { router as repairsRoutes };
