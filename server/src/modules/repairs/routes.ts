import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  assignRepairController,
  listAssignableTechniciansController,
  listRepairsController,
  takeRepairWorkController,
} from './controller.js';
import { assignRepairSchema, repairIdParamSchema } from './schema.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(listRepairsController));
router.get('/assignable-technicians', asyncHandler(listAssignableTechniciansController));
router.post('/:id/take-work', roleMiddleware(['tecnico']), validateRequest({ params: repairIdParamSchema }), asyncHandler(takeRepairWorkController));
router.patch(
  '/:id/assignment',
  roleMiddleware(['administrador_general', 'encargado_sucursal']),
  validateRequest({ params: repairIdParamSchema, body: assignRepairSchema }),
  asyncHandler(assignRepairController),
);

export { router as repairsRoutes };
