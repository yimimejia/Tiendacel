import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/role-middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  branchStatusController,
  deletePaymentController,
  getPaymentHistoryController,
  getSubscriptionController,
  listSubscriptionsController,
  pauseSubscriptionController,
  recordPaymentController,
  upsertSubscriptionController,
} from './controller.js';
import { registerSSEClient } from '../../services/sse-broadcaster.js';

const router = Router();

router.get('/branch-status', authMiddleware, asyncHandler(branchStatusController));

router.get('/events', authMiddleware, (req, res) => {
  const branchId = req.user?.branchId ? Number(req.user.branchId) : null;
  if (!branchId) {
    res.status(400).json({ error: 'Sin sucursal asignada' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write('event: connected\ndata: {"ok":true}\n\n');

  const unregister = registerSSEClient(branchId, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(':ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unregister();
  });
});

router.use(authMiddleware, roleMiddleware(['admin_supremo']));

router.get('/', asyncHandler(listSubscriptionsController));
router.get('/:branchId', asyncHandler(getSubscriptionController));
router.get('/:branchId/payments', asyncHandler(getPaymentHistoryController));
router.post('/:branchId', asyncHandler(upsertSubscriptionController));
router.post('/:branchId/payments', asyncHandler(recordPaymentController));
router.patch('/:branchId/pause', asyncHandler(pauseSubscriptionController));
router.delete('/payments/:paymentId', asyncHandler(deletePaymentController));

export { router as subscriptionsRoutes };
