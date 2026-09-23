import { Router } from 'express';
import { createClinicalNote, getClinicalNotesByPatientId } from '../controllers/clinicalNoteController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticateJWT);
router.post('/', createClinicalNote);
router.get('/:patientId', getClinicalNotesByPatientId);

export default router;
