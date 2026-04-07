import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  deletePaymentController,
  getPaymentHistoryController,
  getSubscriptionController,
  listSubscriptionsController,
  recordPaymentController,
  upsertSubscriptionController,
} from './controller.js';

const router = Router();

router.use(authMiddleware, roleMiddleware(['admin_supremo']));

router.get('/', asyncHandler(listSubscriptionsController));
router.get('/:branchId', asyncHandler(getSubscriptionController));
router.get('/:branchId/payments', asyncHandler(getPaymentHistoryController));
router.post('/:branchId', asyncHandler(upsertSubscriptionController));
router.post('/:branchId/payments', asyncHandler(recordPaymentController));
router.delete('/payments/:paymentId', asyncHandler(deletePaymentController));

export { router as subscriptionsRoutes };
