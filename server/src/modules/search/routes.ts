import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { globalSearchController } from './controller.js';

const router = Router();
router.get('/global', authMiddleware, asyncHandler(globalSearchController));

export { router as searchRoutes };
