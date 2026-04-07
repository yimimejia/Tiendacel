import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { loginController, logoutController, meController } from './controller.js';
import { loginSchema } from './schema.js';

const router = Router();

router.post('/login', validateRequest({ body: loginSchema }), asyncHandler(loginController));
router.post('/logout', authMiddleware, asyncHandler(logoutController));
router.get('/me', authMiddleware, asyncHandler(meController));

export { router as authRoutes };
