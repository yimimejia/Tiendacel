import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { loginController, logoutController, meController } from './controller.js';
import { loginSchema } from './schema.js';

const router = Router();

router.post('/login', validateRequest({ body: loginSchema }), loginController);
router.post('/logout', authMiddleware, logoutController);
router.get('/me', authMiddleware, meController);

export { router as authRoutes };
