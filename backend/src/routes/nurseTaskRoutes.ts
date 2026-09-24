import { Router } from 'express';
import {
  createNurseTask,
  listNurseTasks,
  approveNurseTask,
  rejectNurseTask,
  completeNurseTask,
} from '../controllers/nurseTaskController';
import {
  authenticateJWT,
  requireHospitalAdmin,
  requireRole,
} from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateJWT);

router.post('/', requireRole('Head Nurse'), createNurseTask);
router.get('/', listNurseTasks);
router.put('/:id/approve', requireHospitalAdmin, approveNurseTask);
router.put('/:id/reject', requireHospitalAdmin, rejectNurseTask);
router.put('/:id/complete', completeNurseTask);

export default router;