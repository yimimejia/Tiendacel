import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { listRolesController } from './controller.js';

const router = Router();
router.get('/', authMiddleware, listRolesController);

export { router as rolesRoutes };
