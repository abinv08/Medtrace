import { Router } from 'express';
import {
  getPatientById,
  getPatients,
  createPatient,
  updatePatient,
} from '../controllers/patientController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Protect all routes with JWT authentication
router.use(authenticateJWT);

// Endpoint: GET /api/patients (list, filterable by ?doctorId=... or ?caretakerId=...)
router.get('/', getPatients);

// Endpoint: GET /api/patients/:id (get one by patient ID or user ID)
router.get('/:id', getPatientById);

// Endpoint: POST /api/patients (create patient profile)
router.post('/', createPatient);

// Endpoint: PUT /api/patients/:id (update patient profile)
router.put('/:id', updatePatient);

export default router;
