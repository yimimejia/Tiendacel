import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createCustomerController, getCustomerDetailController, listCustomersController, updateCustomerController } from './controller.js';
import { createCustomerSchema, customerIdParamSchema, updateCustomerSchema } from './schema.js';

const router = Router();

router.use(authMiddleware);
router.get('/', asyncHandler(listCustomersController));
router.post('/', validateRequest({ body: createCustomerSchema }), asyncHandler(createCustomerController));
router.get('/:id', validateRequest({ params: customerIdParamSchema }), asyncHandler(getCustomerDetailController));
router.patch('/:id', validateRequest({ params: customerIdParamSchema, body: updateCustomerSchema }), asyncHandler(updateCustomerController));

export { router as customersRoutes };
