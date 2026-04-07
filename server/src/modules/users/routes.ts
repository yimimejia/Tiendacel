import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import {
  createUserController,
  getUserController,
  listUsersController,
  resetPasswordController,
  toggleUserStatusController,
  updateUserController,
} from './controller.js';
import { createUserSchema, resetPasswordSchema, toggleUserSchema, updateUserSchema, userIdParamSchema } from './schema.js';

const router = Router();

router.use(authMiddleware, roleMiddleware(['administrador_general']));

router.get('/', listUsersController);
router.post('/', validateRequest({ body: createUserSchema }), createUserController);
router.get('/:id', validateRequest({ params: userIdParamSchema }), getUserController);
router.patch('/:id', validateRequest({ params: userIdParamSchema, body: updateUserSchema }), updateUserController);
router.patch('/:id/reset-password', validateRequest({ params: userIdParamSchema, body: resetPasswordSchema }), resetPasswordController);
router.patch('/:id/toggle-status', validateRequest({ params: userIdParamSchema, body: toggleUserSchema }), toggleUserStatusController);

export { router as usersRoutes };
