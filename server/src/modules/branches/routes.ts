import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createBranchController,
  getBranchController,
  listBranchesController,
  toggleBranchStatusController,
  updateBranchController,
} from './controller.js';
import { branchIdParamSchema, createBranchSchema, toggleBranchSchema, updateBranchSchema } from './schema.js';

const router = Router();

router.get('/', authMiddleware, asyncHandler(listBranchesController));
router.get('/:id', authMiddleware, validateRequest({ params: branchIdParamSchema }), asyncHandler(getBranchController));

router.post(
  '/',
  authMiddleware,
  roleMiddleware(['administrador_general', 'admin_supremo']),
  validateRequest({ body: createBranchSchema }),
  asyncHandler(createBranchController),
);

router.patch(
  '/:id',
  authMiddleware,
  roleMiddleware(['administrador_general', 'admin_supremo']),
  validateRequest({ params: branchIdParamSchema, body: updateBranchSchema }),
  asyncHandler(updateBranchController),
);

router.patch(
  '/:id/toggle-status',
  authMiddleware,
  roleMiddleware(['administrador_general', 'admin_supremo']),
  validateRequest({ params: branchIdParamSchema, body: toggleBranchSchema }),
  asyncHandler(toggleBranchStatusController),
);

export { router as branchesRoutes };
