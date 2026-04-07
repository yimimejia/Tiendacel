import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import {
  createBranchController,
  getBranchController,
  listBranchesController,
  toggleBranchStatusController,
  updateBranchController,
} from './controller.js';
import { branchIdParamSchema, createBranchSchema, toggleBranchSchema, updateBranchSchema } from './schema.js';

const router = Router();

router.get('/', authMiddleware, listBranchesController);
router.get('/:id', authMiddleware, validateRequest({ params: branchIdParamSchema }), getBranchController);

router.post(
  '/',
  authMiddleware,
  roleMiddleware(['administrador_general']),
  validateRequest({ body: createBranchSchema }),
  createBranchController,
);

router.patch(
  '/:id',
  authMiddleware,
  roleMiddleware(['administrador_general']),
  validateRequest({ params: branchIdParamSchema, body: updateBranchSchema }),
  updateBranchController,
);

router.patch(
  '/:id/toggle-status',
  authMiddleware,
  roleMiddleware(['administrador_general']),
  validateRequest({ params: branchIdParamSchema, body: toggleBranchSchema }),
  toggleBranchStatusController,
);

export { router as branchesRoutes };
