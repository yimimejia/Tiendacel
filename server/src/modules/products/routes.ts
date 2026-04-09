import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createProductController,
  deleteProductController,
  listProductsController,
  updateProductController,
} from './controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(listProductsController));
router.post('/', asyncHandler(createProductController));
router.put('/:id', asyncHandler(updateProductController));
router.delete('/:id', asyncHandler(deleteProductController));

export { router as productsRoutes };
