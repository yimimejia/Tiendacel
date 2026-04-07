import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { uploadDevicePhotosController } from './controller.js';
import { uploadDevicePhoto } from './service.js';

const router = Router();
router.post('/devices/:deviceId/photos', authMiddleware, uploadDevicePhoto.array('photos', 5), asyncHandler(uploadDevicePhotosController));

export { router as uploadsRoutes };
