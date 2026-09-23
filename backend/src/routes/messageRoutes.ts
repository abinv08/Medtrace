import { Router } from 'express';
import { sendMessage, getPatientMessages } from '../controllers/messageController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticateJWT);
router.post('/', sendMessage);
router.get('/:patientId', getPatientMessages);

export default router;
