import { Router } from 'express';
import {
  getMedicationsByPatientId,
  createMedication,
  updateMedication,
  deleteMedication,
  logMedicationTaken,
} from '../controllers/medicationController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Protect all medication routes with JWT authentication
router.use(authenticateJWT);

// Endpoint: POST /api/medications (create medication)
router.post('/', createMedication);

// Endpoint: GET /api/medications/:patientId (list medications for a patient)
router.get('/:patientId', getMedicationsByPatientId);

// Endpoint: PUT /api/medications/:id (update medication)
router.put('/:id', updateMedication);

// Endpoint: DELETE /api/medications/:id (delete medication)
router.delete('/:id', deleteMedication);

// Endpoint: POST /api/medications/:id/taken (log a dose as taken)
router.post('/:id/taken', logMedicationTaken);

export default router;
