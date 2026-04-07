import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { listRolesController } from './controller.js';

const router = Router();
router.get('/', authMiddleware, asyncHandler(listRolesController));

export { router as rolesRoutes };
