import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  assignRepairController,
  listAllCompletedRepairsController,
  listAssignableTechniciansController,
  listRepairsController,
  takeRepairWorkController,
  updateRepairStatusController,
} from './controller.js';
import { assignRepairSchema, repairIdParamSchema } from './schema.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(listRepairsController));
router.get('/completed', asyncHandler(listAllCompletedRepairsController));
router.get('/assignable-technicians', asyncHandler(listAssignableTechniciansController));
router.post('/:id/take-work', roleMiddleware(['tecnico', 'mensajero', 'empleado', 'encargado_sucursal']), validateRequest({ params: repairIdParamSchema }), asyncHandler(takeRepairWorkController));
router.patch(
  '/:id/assignment',
  roleMiddleware(['administrador_general', 'encargado_sucursal']),
  validateRequest({ params: repairIdParamSchema, body: assignRepairSchema }),
  asyncHandler(assignRepairController),
);
router.patch(
  '/:id/status',
  roleMiddleware(['administrador_general', 'encargado_sucursal', 'tecnico', 'mensajero', 'empleado']),
  validateRequest({ params: repairIdParamSchema }),
  asyncHandler(updateRepairStatusController),
);

export { router as repairsRoutes };
