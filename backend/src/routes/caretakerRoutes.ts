import { Router } from 'express';
import {
  assignCaretaker,
  revokeCaretakerAssignment,
  getAssignedPatients,
  getPatientCaretakers,
} from '../controllers/caretakerController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Protect all caretaker routes with JWT authentication
router.use(authenticateJWT);

// Endpoint: POST /api/caretaker/assign (assign a caretaker to a patient)
router.post('/assign', assignCaretaker);

// Endpoint: PUT /api/caretaker/:id/revoke (revoke access)
router.put('/:id/revoke', revokeCaretakerAssignment);

// Endpoint: GET /api/caretaker/:caretakerId/patients (list patients assigned to this caretaker)
router.get('/:caretakerId/patients', getAssignedPatients);

// Endpoint: GET /api/caretaker/patient/:patientId (list caretakers assigned to this patient)
router.get('/patient/:patientId', getPatientCaretakers);

export default router;

