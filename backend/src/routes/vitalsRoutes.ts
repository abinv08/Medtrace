import { Router } from 'express';
import {
  createVitals,
  getVitalsHistory,
  getLatestVitals,
} from '../controllers/vitalsController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Protect all vitals routes with JWT authentication
router.use(authenticateJWT);

// Endpoint: POST /api/vitals (add a new vitals reading)
router.post('/', createVitals);

// Endpoint: GET /api/vitals/:patientId/latest (most recent vitals reading)
router.get('/:patientId/latest', getLatestVitals);

// Endpoint: GET /api/vitals/:patientId (vitals history with optional ?from=&to=)
router.get('/:patientId', getVitalsHistory);

export default router;
