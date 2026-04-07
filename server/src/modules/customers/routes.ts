import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { validateRequest } from '../../middlewares/validate-request.js';
import { createCustomerController, getCustomerDetailController, listCustomersController, updateCustomerController } from './controller.js';
import { createCustomerSchema, customerIdParamSchema, updateCustomerSchema } from './schema.js';

const router = Router();

router.use(authMiddleware);
router.get('/', listCustomersController);
router.post('/', validateRequest({ body: createCustomerSchema }), createCustomerController);
router.get('/:id', validateRequest({ params: customerIdParamSchema }), getCustomerDetailController);
router.patch('/:id', validateRequest({ params: customerIdParamSchema, body: updateCustomerSchema }), updateCustomerController);

export { router as customersRoutes };
