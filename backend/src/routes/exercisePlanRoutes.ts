import { Router } from 'express';
import {
  createExercisePlan,
  getExercisePlanByPatientId,
  logExerciseProgress,
} from '../controllers/exercisePlanController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Protect all exercise plan routes with JWT authentication
router.use(authenticateJWT);

// Endpoint: POST /api/exercise-plans (create/assign a plan)
router.post('/', createExercisePlan);

// Endpoint: GET /api/exercise-plans/:patientId (get plan for patient)
router.get('/:patientId', getExercisePlanByPatientId);

// Endpoint: PUT /api/exercise-plans/:id/progress (log a completed session)
router.put('/:id/progress', logExerciseProgress);

export default router;
