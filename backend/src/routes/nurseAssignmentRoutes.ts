import { Router } from 'express';
import {
  assignNurse,
  revokeNurseAssignment,
  getAssignedPatients,
  getHeadNurseRoster,
} from '../controllers/nurseAssignmentController';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateJWT);

router.get('/head-nurse/roster', requireRole('Head Nurse'), getHeadNurseRoster);
router.post('/', requireRole('Head Nurse', 'Hospital Administrator', 'Admin'), assignNurse);
router.put('/:id/revoke', requireRole('Head Nurse', 'Hospital Administrator', 'Admin'), revokeNurseAssignment);
router.get('/:nurseId/patients', getAssignedPatients);

export default router;