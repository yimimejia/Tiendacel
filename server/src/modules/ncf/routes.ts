import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  deleteNcfController,
  getNcfTypesController,
  getNextNcfController,
  listNcfController,
  patchNcfController,
  upsertNcfController,
} from './controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/types', asyncHandler(getNcfTypesController));
router.get('/', asyncHandler(listNcfController));
router.post('/', asyncHandler(upsertNcfController));
router.patch('/:id', asyncHandler(patchNcfController));
router.delete('/:id', asyncHandler(deleteNcfController));
router.post('/next', asyncHandler(getNextNcfController));

export { router as ncfRoutes };
