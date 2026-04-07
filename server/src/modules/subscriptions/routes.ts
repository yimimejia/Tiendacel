import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
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

router.get('/', listSubscriptionsController);
router.get('/:branchId', getSubscriptionController);
router.get('/:branchId/payments', getPaymentHistoryController);
router.post('/:branchId', upsertSubscriptionController);
router.post('/:branchId/payments', recordPaymentController);
router.delete('/payments/:paymentId', deletePaymentController);

export { router as subscriptionsRoutes };
