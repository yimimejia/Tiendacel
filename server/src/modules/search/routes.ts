import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { globalSearchController } from './controller.js';

const router = Router();
router.get('/global', authMiddleware, globalSearchController);

export { router as searchRoutes };
